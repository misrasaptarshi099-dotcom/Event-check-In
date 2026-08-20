import { NextResponse } from 'next/server';
import { performCheckin, CheckinError } from '@/lib/services/checkins.service';
import { getRegistrationById } from '@/lib/services/registrations.service';
import { getEventById } from '@/lib/services/events.service';
import { verifyAuthToken, requireRole } from '@/lib/security/rbac';
import { checkRateLimit, getRateLimitKey, CHECKIN_SCAN_LIMIT } from '@/lib/security/rateLimit';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const authUser = await verifyAuthToken(authHeader);
    requireRole(authUser, 'organizer');

    const rateLimitRes = checkRateLimit(getRateLimitKey(request, authUser.uid), CHECKIN_SCAN_LIMIT);
    if (rateLimitRes) return rateLimitRes;

    const body = await request.json();
    const { eventId, registrationId, stationId, clientScanId, clientScannedAt } = body;

    if (!eventId || !registrationId || !clientScanId) {
      return NextResponse.json({ error: 'Missing required sync fields.' }, { status: 400 });
    }

    const event = await getEventById(eventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    const scanTimeMs = clientScannedAt ? new Date(clientScannedAt).getTime() : Date.now();
    const eventStartMs = new Date(event.eventDate).getTime();
    const checkinOpenMs = eventStartMs - (30 * 60 * 1000);
    const eventEndMs = event.eventEndDate
      ? new Date(event.eventEndDate).getTime()
      : eventStartMs + (3 * 60 * 60 * 1000);

    if (scanTimeMs < checkinOpenMs) {
      return NextResponse.json(
        { error: 'Gate admission had not opened at time of scan (opens 30 mins before event start).' },
        { status: 400 }
      );
    }
    if (scanTimeMs >= eventEndMs) {
      return NextResponse.json(
        { error: 'Event was already concluded at time of scan.' },
        { status: 400 }
      );
    }

    const registration = await getRegistrationById(registrationId);
    if (!registration || registration.eventId !== eventId) {
      return NextResponse.json({ error: 'Registration not found for this event.' }, { status: 404 });
    }

    try {
      const checkin = await performCheckin({
        eventId,
        registrationId,
        attendeeName: registration.attendeeName,
        attendeeEmail: registration.attendeeEmail,
        stationId: stationId || 'Offline-Station',
        source: 'offline_sync',
        clientScanId,
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
