import { adminDb } from '@/lib/firebase/admin';
import type { Checkin, CheckinSyncLog, CheckinSource, SyncResult } from '@/types';

export class CheckinError extends Error {
  public readonly statusCode: number;
  public readonly existingCheckin?: Checkin;

  constructor(statusCode: number, message: string, existingCheckin?: Checkin) {
    super(message);
    this.name = 'CheckinError';
    this.statusCode = statusCode;
    this.existingCheckin = existingCheckin;
  }
}

/**
 * Atomic Single Check-In with Duplicate Prevention (HR-1)
 *
 * Executes a Firestore runTransaction to:
 * 1. Check if `events/{eventId}/checkins/{registrationId}` already exists.
 * 2. If exists, return 409 with the original check-in timestamp and station.
 * 3. If new, create the checkin record atomically.
 * 4. Log the scan attempt to `checkin_sync_log` for audit.
 */
export async function performCheckin(params: {
  eventId: string;
  registrationId: string;
  attendeeName: string;
  attendeeEmail: string;
  stationId: string;
  source: CheckinSource;
  clientScanId: string;
  clientScannedAt?: string;
}): Promise<Checkin> {
  const {
    eventId,
    registrationId,
    attendeeName,
    attendeeEmail,
    stationId,
    source,
    clientScanId,
    clientScannedAt,
  } = params;

  const checkinRef = adminDb
    .collection('events')
    .doc(eventId)
    .collection('checkins')
    .doc(registrationId);

  const syncLogRef = adminDb.collection('checkin_sync_log').doc(clientScanId);

  return adminDb.runTransaction(async (transaction) => {
    // 1. Check for idempotent sync replay (same clientScanId already processed)
    const existingSyncLog = await transaction.get(syncLogRef);
    if (existingSyncLog.exists) {
      const logData = existingSyncLog.data() as CheckinSyncLog;
      if (logData.result === 'success') {
        // Idempotent: return original checkin without creating a duplicate
        const originalCheckin = await transaction.get(checkinRef);
        if (originalCheckin.exists) {
          return originalCheckin.data() as Checkin;
        }
      }
    }

    // 2. Check if this registration has already been checked in
    const existingCheckin = await transaction.get(checkinRef);
    if (existingCheckin.exists) {
      const existing = existingCheckin.data() as Checkin;

      // Log the duplicate attempt
      const syncLog: CheckinSyncLog = {
        id: clientScanId,
        registrationId,
        eventId,
        stationId,
        clientScanId,
        clientScannedAt: clientScannedAt || new Date().toISOString(),
        syncedAt: new Date().toISOString(),
        source,
        result: 'duplicate_conflict' as SyncResult,
        conflictingCheckinId: existing.id,
        createdAt: new Date().toISOString(),
      };
      transaction.set(syncLogRef, syncLog);

      throw new CheckinError(
        409,
        `Already checked in at ${existing.checkedInAt} at station ${existing.stationId}.`,
        existing
      );
    }

    // 3. Create the checkin record
    const now = new Date().toISOString();
    const checkin: Checkin = {
      id: `${eventId}_${registrationId}`,
      registrationId,
      eventId,
      attendeeName,
      attendeeEmail,
      checkedInAt: now,
      clientScannedAt: clientScannedAt || now,
      stationId,
      source,
      clientScanId,
      createdAt: now,
    };

    transaction.set(checkinRef, checkin);

    // 4. Log the successful scan
    const syncLog: CheckinSyncLog = {
      id: clientScanId,
      registrationId,
      eventId,
      stationId,
      clientScanId,
      clientScannedAt: clientScannedAt || now,
      syncedAt: now,
      source,
      result: 'success' as SyncResult,
      createdAt: now,
    };
    transaction.set(syncLogRef, syncLog);

    return checkin;
  });
}

/**
 * Retrieves all check-ins for an event.
 */
export async function getCheckinsByEvent(eventId: string): Promise<Checkin[]> {
  const snapshot = await adminDb
    .collection('events')
    .doc(eventId)
    .collection('checkins')
    .orderBy('checkedInAt', 'desc')
    .get();

  return snapshot.docs.map((doc) => doc.data() as Checkin);
}

/**
 * Retrieves sync logs for an event (for conflict inspection).
 */
export async function getSyncLogsByEvent(eventId: string): Promise<CheckinSyncLog[]> {
  const snapshot = await adminDb
    .collection('checkin_sync_log')
    .where('eventId', '==', eventId)
    .orderBy('syncedAt', 'desc')
    .get();

  return snapshot.docs.map((doc) => doc.data() as CheckinSyncLog);
}
