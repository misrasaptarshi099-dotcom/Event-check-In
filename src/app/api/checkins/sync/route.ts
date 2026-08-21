import { NextResponse } from 'next/server';
import { performCheckin, CheckinError } from '@/lib/services/checkins.service';
import { getRegistrationById } from '@/lib/services/registrations.service';
import { getEventById } from '@/lib/services/events.service';
import { parseAndVerifyQrPayload, verifyTotpToken } from '@/lib/security/totp';
import { verifyAuthToken, requireRole, requireOwnership } from '@/lib/security/rbac';
import { checkRateLimit, getRateLimitKey, CHECKIN_SCAN_LIMIT } from '@/lib/security/rateLimit';
import { sanitizeText } from '@/lib/security/sanitize';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const authUser = await verifyAuthToken(authHeader);
    requireRole(authUser, 'organizer');

    const rateLimitRes = checkRateLimit(getRateLimitKey(request, authUser.uid), CHECKIN_SCAN_LIMIT);
    if (rateLimitRes) return rateLimitRes;

    const body = await request.json();
    const cleanEventId = sanitizeText(body.eventId, 128);
    const cleanRegId = sanitizeText(body.registrationId, 128);
    const cleanScanId = sanitizeText(body.clientScanId, 128);
    const cleanStationId = sanitizeText(body.stationId, 64) || 'Station-Offline';
    const { clientScannedAt, qrToken, otp, rawQrPayload } = body;

    if (!cleanEventId || !cleanRegId || !cleanScanId) {
      return NextResponse.json({ error: 'Missing required sync fields.' }, { status: 400 });
    }

    const event = await getEventById(cleanEventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    if (event.status === 'cancelled') {
      return NextResponse.json({ error: 'This event has been cancelled by the host.' }, { status: 400 });
    }

    requireOwnership(authUser, event.organizerId);

    const now = Date.now();
    const eventStartMs = new Date(event.eventDate).getTime();
    const checkinOpenMs = eventStartMs - (30 * 60 * 1000);
    const eventEndMs = event.eventEndDate
      ? new Date(event.eventEndDate).getTime()
      : eventStartMs + (3 * 60 * 60 * 1000);

    if (now < checkinOpenMs) {
      return NextResponse.json(
        { error: 'Gate admission has not opened yet (opens 30 mins before event start).' },
        { status: 400 }
      );
    }
    if (now >= eventEndMs) {
      return NextResponse.json(
        { error: 'Event has concluded. Gate check-in is closed.' },
        { status: 400 }
      );
    }

    const registration = await getRegistrationById(cleanRegId);
    if (!registration || registration.eventId !== cleanEventId) {
      return NextResponse.json({ error: 'Registration not found for this event.' }, { status: 404 });
    }

    if (registration.status !== 'active') {
      return NextResponse.json({ error: 'Registration is cancelled.' }, { status: 400 });
    }

    // Credential Verification
    if (rawQrPayload) {
      const verification = parseAndVerifyQrPayload(
        rawQrPayload,
        registration.totpSecret,
        cleanRegId,
        cleanEventId
      );
      if (!verification.isValid) {
        return NextResponse.json({ error: verification.error || 'Invalid QR payload.' }, { status: 400 });
      }
    } else if (otp) {
      const isOtpValid = verifyTotpToken(otp.trim(), registration.totpSecret);
      if (!isOtpValid) {
        return NextResponse.json({ error: 'Invalid manual OTP code.' }, { status: 400 });
      }
    } else if (qrToken) {
      if (qrToken !== registration.qrToken && qrToken !== registration.id) {
        return NextResponse.json({ error: 'Invalid QR token credential.' }, { status: 400 });
      }
    }

    try {
      const checkin = await performCheckin({
        eventId: cleanEventId,
        registrationId: cleanRegId,
        attendeeName: registration.attendeeName,
        attendeeEmail: registration.attendeeEmail,
        stationId: cleanStationId,
        source: 'offline_sync',
        clientScanId: cleanScanId,
        clientScannedAt: clientScannedAt || new Date().toISOString(),
      });

      return NextResponse.json({ success: true, checkin }, { status: 200 });
    } catch (error: any) {
      if (error instanceof CheckinError && error.statusCode === 409) {
        return NextResponse.json(
          {
            error: 'Duplicate check-in conflict.',
            conflict: true,
            existingCheckin: error.existingCheckin,
          },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Sync failed.' }, { status });
  }
}
