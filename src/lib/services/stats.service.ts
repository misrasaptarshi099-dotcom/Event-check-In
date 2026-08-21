import { adminDb } from '@/lib/firebase/admin';
import type { StatsBundle, CheckinTimeBucket, Checkin, EventItem, Registration } from '@/types';

/**
 * Computes a live StatsBundle for a given event.
 *
 * Reads from Firestore collections to calculate:
 * - Total capacity & spots remaining
 * - Registered count
 * - Checked-in count
 * - No-show count and percentage (clamped to 0)
 * - 15-minute check-in distribution histogram (timezone-aware)
 * - Peak check-in bucket
 */
export async function computeEventStats(eventId: string): Promise<StatsBundle> {
  // Fetch event metadata
  const eventDoc = await adminDb.collection('events').doc(eventId).get();
  if (!eventDoc.exists) {
    throw new Error(`Event ${eventId} not found.`);
  }
  const event = eventDoc.data() as EventItem;

  // Fetch active registrations and sum total booked seats
  const registrationsSnap = await adminDb
    .collection('registrations')
    .where('eventId', '==', eventId)
    .where('status', '==', 'active')
    .get();

  const regGuestMap = new Map<string, number>();
  let registeredCount = 0;
  for (const doc of registrationsSnap.docs) {
    const data = doc.data() as Registration;
    const guests = data.guestCount || 1;
    regGuestMap.set(doc.id, guests);
    registeredCount += guests;
  }

  // Fetch all check-ins and sum admitted seats
  const checkinsSnap = await adminDb
    .collection('events')
    .doc(eventId)
    .collection('checkins')
    .get();
  const checkins = checkinsSnap.docs.map((doc) => doc.data() as Checkin);
  let checkedInCount = 0;
  for (const checkin of checkins) {
    const seats = regGuestMap.get(checkin.registrationId);
    if (seats !== undefined) {
      checkedInCount += seats;
    }
  }

  // Determine if the event has concluded
  const now = Date.now();
  const eventStartTime = new Date(event.eventDate).getTime();
  // If eventEndDate is explicitly set, use that; otherwise default to 3 hours after start time
  const eventEndTime = event.eventEndDate
    ? new Date(event.eventEndDate).getTime()
    : eventStartTime + (3 * 60 * 60 * 1000);

  const isEventFinished = now >= eventEndTime;

  // Compute no-show metrics (only calculated after event concludes)
  const noShowCount = isEventFinished ? Math.max(0, registeredCount - checkedInCount) : 0;
  const noShowPct = isEventFinished
    ? (registeredCount > 0 ? Math.round((noShowCount / registeredCount) * 100) : 0)
    : null;

  // Resolve event timezone for stable bucketing across deployments
  const eventTimezone = event.timezone || 'UTC';

  // Compute 15-minute distribution using event timezone
  const bucketMap = new Map<string, number>();
  for (const checkin of checkins) {
    const date = new Date(checkin.checkedInAt);
    // Use Intl.DateTimeFormat with explicit h23 cycle for timezone-aware hour/minute extraction
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: eventTimezone,
    }).formatToParts(date);

    const hourPart = parts.find((p) => p.type === 'hour')?.value || '00';
    const minutePart = parts.find((p) => p.type === 'minute')?.value || '00';
    const minuteBucket = (Math.floor(parseInt(minutePart) / 15) * 15)
      .toString()
      .padStart(2, '0');
    const bucketKey = `${hourPart}:${minuteBucket}`;
    const checkinSeats = regGuestMap.get(checkin.registrationId) || 1;
    bucketMap.set(bucketKey, (bucketMap.get(bucketKey) || 0) + checkinSeats);
  }

  const checkinsBy15Min: CheckinTimeBucket[] = Array.from(bucketMap.entries())
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));

  // Find peak bucket
  let peakCheckinBucket = 'N/A';
  let peakCheckinCount = 0;
  for (const entry of checkinsBy15Min) {
    if (entry.count > peakCheckinCount) {
      peakCheckinBucket = entry.bucket;
      peakCheckinCount = entry.count;
    }
  }

  return {
    eventId,
    eventName: event.name,
    eventDate: event.eventDate,
    eventEndDate: event.eventEndDate,
    isEventFinished,
    capacity: event.capacity,
    spotsRemaining: event.spotsRemaining,
    registeredCount,
    checkedInCount,
    noShowCount,
    noShowPct,
    checkinsBy15Min,
    peakCheckinBucket,
    peakCheckinCount,
    computedAt: new Date().toISOString(),
  };
}
