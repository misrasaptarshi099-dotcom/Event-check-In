import { adminDb } from '@/lib/firebase/admin';
import type { StatsBundle, CheckinTimeBucket, Checkin, EventItem } from '@/types';

/**
 * Computes a live StatsBundle for a given event.
 *
 * Reads from Firestore collections to calculate:
 * - Total capacity & spots remaining
 * - Registered count
 * - Checked-in count
 * - No-show count and percentage
 * - 15-minute check-in distribution histogram
 * - Peak check-in bucket
 */
export async function computeEventStats(eventId: string): Promise<StatsBundle> {
  // Fetch event metadata
  const eventDoc = await adminDb.collection('events').doc(eventId).get();
  if (!eventDoc.exists) {
    throw new Error(`Event ${eventId} not found.`);
  }
  const event = eventDoc.data() as EventItem;

  // Fetch registration count
  const registrationsSnap = await adminDb
    .collection('registrations')
    .where('eventId', '==', eventId)
    .where('status', '==', 'active')
    .count()
    .get();
  const registeredCount = registrationsSnap.data().count;

  // Fetch all check-ins
  const checkinsSnap = await adminDb
    .collection('events')
    .doc(eventId)
    .collection('checkins')
    .get();
  const checkins = checkinsSnap.docs.map((doc) => doc.data() as Checkin);
  const checkedInCount = checkins.length;

  // Compute no-show metrics
  const noShowCount = registeredCount - checkedInCount;
  const noShowPct = registeredCount > 0 ? Math.round((noShowCount / registeredCount) * 100) : 0;

  // Compute 15-minute distribution
  const bucketMap = new Map<string, number>();
  for (const checkin of checkins) {
    const date = new Date(checkin.checkedInAt);
    const hours = date.getHours().toString().padStart(2, '0');
    const minuteBucket = (Math.floor(date.getMinutes() / 15) * 15).toString().padStart(2, '0');
    const bucketKey = `${hours}:${minuteBucket}`;
    bucketMap.set(bucketKey, (bucketMap.get(bucketKey) || 0) + 1);
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
