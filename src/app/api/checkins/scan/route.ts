import { NextResponse } from 'next/server';
import { performCheckin, CheckinError } from '@/lib/services/checkins.service';
import { getRegistrationById } from '@/lib/services/registrations.service';
import { parseAndVerifyQrPayload } from '@/lib/security/totp';
import { checkRateLimit, getRateLimitKey, CHECKIN_SCAN_LIMIT } from '@/lib/security/rateLimit';
import type { ScanOutcome } from '@/types';

export async function POST(request: Request) {
  try {
    // Station-based rate limiting (max 60 scans/min per station)
    const rateLimitRes = checkRateLimit(getRateLimitKey(request), CHECKIN_SCAN_LIMIT);
    if (rateLimitRes) return rateLimitRes;

    const body = await request.json();
    const { rawQrPayload, stationId, clientScanId, eventId, registrationId, otp } = body;

    const station = stationId?.trim() || 'Station-Main';
    const scanId = clientScanId || crypto.randomUUID();

    let targetRegId = registrationId;
    let targetEventId = eventId;

    // If raw QR payload is provided from camera stream
    if (rawQrPayload) {
      try {
        const parsed = JSON.parse(rawQrPayload);
        targetRegId = parsed.r;
        targetEventId = parsed.e;
      } catch {
        const outcome: ScanOutcome = {
          status: 'INVALID',
          message: 'Malformed QR payload.',
        };
        return NextResponse.json(outcome, { status: 400 });
      }
    }

    if (!targetRegId || !targetEventId) {
      const outcome: ScanOutcome = {
        status: 'INVALID',
        message: 'Missing registration ID or event ID.',
      };
      return NextResponse.json(outcome, { status: 400 });
    }

    // Fetch authoritative registration
    const registration = await getRegistrationById(targetRegId);
    if (!registration || registration.eventId !== targetEventId) {
      const outcome: ScanOutcome = {
        status: 'INVALID',
        message: 'Registration not found for this event.',
      };
      return NextResponse.json(outcome, { status: 404 });
    }

    if (registration.status !== 'active') {
      const outcome: ScanOutcome = {
        status: 'INVALID',
        message: 'Registration is cancelled.',
      };
      return NextResponse.json(outcome, { status: 400 });
    }

    // If rawQrPayload provided, verify TOTP token strictly
    if (rawQrPayload) {
      const verification = parseAndVerifyQrPayload(
        rawQrPayload,
        registration.totpSecret,
        targetRegId,
        targetEventId
      );

      if (!verification.isValid) {
        const outcome: ScanOutcome = {
          status: 'INVALID',
          message: verification.error || 'Invalid or expired TOTP code (anti-screenshot rule).',
        };
        return NextResponse.json(outcome, { status: 400 });
      }
    }

    // Perform atomic checkin in Firestore transaction
    try {
      const checkin = await performCheckin({
        eventId: targetEventId,
        registrationId: targetRegId,
        attendeeName: registration.attendeeName,
        attendeeEmail: registration.attendeeEmail,
        stationId: station,
        source: 'online',
        clientScanId: scanId,
        clientScannedAt: new Date().toISOString(),
      });

      const outcome: ScanOutcome = {
        status: 'CONFIRMED',
        message: 'Admitted — check-in confirmed.',
        registrationId: targetRegId,
        attendeeName: registration.attendeeName,
        checkedInAt: checkin.checkedInAt,
        stationId: station,
      };

      return NextResponse.json(outcome, { status: 200 });
    } catch (error: any) {
      if (error instanceof CheckinError && error.statusCode === 409) {
        const outcome: ScanOutcome = {
          status: 'DUPLICATE',
          message: error.message,
          registrationId: targetRegId,
          attendeeName: registration.attendeeName,
          checkedInAt: error.existingCheckin?.checkedInAt,
          stationId: error.existingCheckin?.stationId,
        };
        return NextResponse.json(outcome, { status: 409 });
      }
      throw error;
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Check-in processing failed.' }, { status: 500 });
  }
}
