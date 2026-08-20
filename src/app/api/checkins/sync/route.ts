import { NextResponse } from 'next/server';
import { performCheckin, CheckinError } from '@/lib/services/checkins.service';
import { getRegistrationById } from '@/lib/services/registrations.service';
import { checkRateLimit, getRateLimitKey, CHECKIN_SCAN_LIMIT } from '@/lib/security/rateLimit';

export async function POST(request: Request) {
  try {
    const rateLimitRes = checkRateLimit(getRateLimitKey(request), CHECKIN_SCAN_LIMIT);
    if (rateLimitRes) return rateLimitRes;

    const body = await request.json();
    const { eventId, registrationId, stationId, clientScanId, clientScannedAt } = body;

    if (!eventId || !registrationId || !clientScanId) {
      return NextResponse.json({ error: 'Missing required sync fields.' }, { status: 400 });
    }

    const registration = await getRegistrationById(registrationId);
    if (!registration || registration.eventId !== eventId) {
      return NextResponse.json({ error: 'Registration not found.' }, { status: 404 });
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
    return NextResponse.json({ error: error.message || 'Sync failed.' }, { status: 500 });
  }
}
