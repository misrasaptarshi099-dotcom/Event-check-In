import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { OfflineQueuedScan, CachedRosterEntry } from '@/types';

/**
 * IndexedDB schema for the VOUCH Scanner PWA.
 *
 * Two stores:
 * - `scanQueue`: Queued offline scans pending sync.
 * - `roster`: Encrypted roster cache (stored as raw ArrayBuffer).
 */
interface VouchDB extends DBSchema {
  scanQueue: {
    key: string; // clientScanId
    value: OfflineQueuedScan;
    indexes: {
      'by-status': string;
      'by-event': string;
    };
  };
  roster: {
    key: string; // eventId
    value: {
      eventId: string;
      encryptedData: ArrayBuffer;
      cachedAt: string;
    };
  };
}

const DB_NAME = 'vouch-scanner';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<VouchDB>> | null = null;

/**
 * Opens (or creates) the VOUCH IndexedDB database.
 * Clears the cached promise on failure so subsequent calls can retry.
 */
export function getDB(): Promise<IDBPDatabase<VouchDB>> {
  if (!dbPromise) {
    dbPromise = openDB<VouchDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Scan queue store
        const scanStore = db.createObjectStore('scanQueue', { keyPath: 'clientScanId' });
        scanStore.createIndex('by-status', 'syncStatus');
        scanStore.createIndex('by-event', 'eventId');

        // Roster cache store
        db.createObjectStore('roster', { keyPath: 'eventId' });
      },
    }).catch((err) => {
      // Clear cache so next call retries initialization
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

// ─── Scan Queue Operations ──────────────────────────────────────────

/**
 * Enqueues a scan for offline processing.
 */
export async function enqueueScan(scan: OfflineQueuedScan): Promise<void> {
  const db = await getDB();
  await db.put('scanQueue', scan);
}

/**
 * Retrieves all pending scans (status = 'pending').
 */
export async function getPendingScans(): Promise<OfflineQueuedScan[]> {
  const db = await getDB();
  return db.getAllFromIndex('scanQueue', 'by-status', 'pending');
}

/**
 * Retrieves scans in 'syncing' or 'failed' states for drain recovery.
 */
export async function getRecoverableScans(): Promise<OfflineQueuedScan[]> {
  const db = await getDB();
  const syncing = await db.getAllFromIndex('scanQueue', 'by-status', 'syncing');
  const failed = await db.getAllFromIndex('scanQueue', 'by-status', 'failed');
  return [...syncing, ...failed];
}

/**
 * Updates the sync status of a queued scan within a single readwrite transaction
 * to prevent concurrent writers from overwriting intervening changes.
 */
export async function updateScanStatus(
  clientScanId: string,
  status: OfflineQueuedScan['syncStatus'],
  syncResult?: OfflineQueuedScan['syncResult']
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('scanQueue', 'readwrite');
  const store = tx.objectStore('scanQueue');
  const scan = await store.get(clientScanId);
  if (scan) {
    scan.syncStatus = status;
    if (syncResult) scan.syncResult = syncResult;
    await store.put(scan);
  }
  await tx.done;
}

/**
 * Retrieves all scans for a given event.
 */
export async function getScansByEvent(eventId: string): Promise<OfflineQueuedScan[]> {
  const db = await getDB();
  return db.getAllFromIndex('scanQueue', 'by-event', eventId);
}

/**
 * Clears all synced scans from the queue.
 */
export async function clearSyncedScans(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('scanQueue', 'readwrite');
  const store = tx.objectStore('scanQueue');
  const index = store.index('by-status');
  let cursor = await index.openCursor('synced');

  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await tx.done;
}

// ─── Roster Cache Operations ────────────────────────────────────────

/**
 * Caches an encrypted roster ArrayBuffer for an event.
 */
export async function cacheEncryptedRoster(
  eventId: string,
  encryptedData: ArrayBuffer
): Promise<void> {
  const db = await getDB();
  await db.put('roster', {
    eventId,
    encryptedData,
    cachedAt: new Date().toISOString(),
  });
}

/**
 * Retrieves the encrypted roster for an event.
 */
export async function getEncryptedRoster(
  eventId: string
): Promise<ArrayBuffer | null> {
  const db = await getDB();
  const entry = await db.get('roster', eventId);
  return entry?.encryptedData ?? null;
}

/**
 * Clears the cached roster for an event (e.g., on logout or event end).
 */
export async function clearRosterCache(eventId: string): Promise<void> {
  const db = await getDB();
  await db.delete('roster', eventId);
}
