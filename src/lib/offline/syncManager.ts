import {
  getPendingScans,
  getRecoverableScans,
  updateScanStatus,
  clearSyncedScans,
} from './db';
import type { OfflineQueuedScan, SyncResult } from '@/types';

/**
 * Offline Sync Manager — Idempotent Queue Drain (HR-3)
 *
 * When the scanner device regains network connectivity:
 * 1. Recovers interrupted (syncing) and exhausted (failed) scans.
 * 2. Reads all pending scans from IndexedDB.
 * 3. Submits each scan to the server sync endpoint.
 * 4. Updates scan status based on server response.
 * 5. Handles duplicate conflicts gracefully (no data loss).
 * 6. Cleans up successfully synced entries.
 *
 * Each scan carries a unique `clientScanId` for idempotent replay.
 */

const SYNC_ENDPOINT = '/api/checkins/sync';
const MAX_CONCURRENT_SYNCS = 5;
const RETRY_DELAY_MS = 2_000;
const MAX_RETRIES = 3;

/** Module-level in-flight guard to prevent overlapping drains */
let activeDrain: Promise<{
  total: number;
  synced: number;
  conflicts: number;
  failed: number;
}> | null = null;

/**
 * Drains the offline queue by syncing all pending scans to the server.
 * Serializes concurrent calls so the same pending scans aren't submitted twice.
 * Returns a summary of sync results.
 */
export async function drainOfflineQueue(): Promise<{
  total: number;
  synced: number;
  conflicts: number;
  failed: number;
}> {
  if (activeDrain) {
    return activeDrain;
  }

  activeDrain = performDrain();
  try {
    return await activeDrain;
  } finally {
    activeDrain = null;
  }
}

async function performDrain(): Promise<{
  total: number;
  synced: number;
  conflicts: number;
  failed: number;
}> {
  // Recover interrupted and failed scans before draining
  const recoverable = await getRecoverableScans();
  for (const scan of recoverable) {
    await updateScanStatus(scan.clientScanId, 'pending');
  }

  const pending = await getPendingScans();
  const results = { total: pending.length, synced: 0, conflicts: 0, failed: 0 };

  if (pending.length === 0) return results;

  // Process in batches to limit concurrent requests
  for (let i = 0; i < pending.length; i += MAX_CONCURRENT_SYNCS) {
    const batch = pending.slice(i, i + MAX_CONCURRENT_SYNCS);
    const batchResults = await Promise.allSettled(
      batch.map((scan) => syncSingleScan(scan))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const outcome = result.value;
        if (outcome === 'success') results.synced++;
        else if (outcome === 'duplicate_conflict') results.conflicts++;
        else results.failed++;
      } else {
        results.failed++;
      }
    }
  }

  // Clean up successfully synced entries
  await clearSyncedScans();

  return results;
}

/**
 * Syncs a single scan to the server with retry logic.
 * Non-409 4xx responses are terminal (no retry).
 * 5xx and network errors are retried up to MAX_RETRIES.
 */
async function syncSingleScan(
  scan: OfflineQueuedScan,
  attempt = 1
): Promise<SyncResult> {
  try {
    await updateScanStatus(scan.clientScanId, 'syncing');

    const response = await fetch(SYNC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: scan.eventId,
        registrationId: scan.registrationId,
        qrToken: scan.qrToken,
        otp: scan.otp,
        stationId: scan.stationId,
        clientScanId: scan.clientScanId,
        clientScannedAt: scan.clientScannedAt,
      }),
    });

    if (response.ok) {
      await updateScanStatus(scan.clientScanId, 'synced', 'success');
      return 'success';
    }

    if (response.status === 409) {
      // Duplicate conflict — expected for multi-station scenarios
      await updateScanStatus(scan.clientScanId, 'conflict', 'duplicate_conflict');
      return 'duplicate_conflict';
    }

    // Non-409 4xx: terminal client error (bad token, invalid data) — no retry
    if (response.status >= 400 && response.status < 500) {
      await updateScanStatus(scan.clientScanId, 'failed', 'invalid_token');
      return 'invalid_token';
    }

    // 5xx server error — retry
    if (attempt < MAX_RETRIES) {
      await delay(RETRY_DELAY_MS * attempt);
      return syncSingleScan(scan, attempt + 1);
    }

    await updateScanStatus(scan.clientScanId, 'failed', 'error');
    return 'error';
  } catch {
    // Network failure — retry
    if (attempt < MAX_RETRIES) {
      await delay(RETRY_DELAY_MS * attempt);
      return syncSingleScan(scan, attempt + 1);
    }

    await updateScanStatus(scan.clientScanId, 'failed', 'error');
    return 'error';
  }
}

/**
 * Registers a listener for online/offline events to auto-trigger sync.
 */
export function registerAutoSync(): () => void {
  const handler = () => {
    if (navigator.onLine) {
      console.log('[VOUCH SYNC] Network restored — draining offline queue...');
      drainOfflineQueue()
        .then((results) => {
          console.log('[VOUCH SYNC] Drain complete:', results);
        })
        .catch((error) => {
          console.error('[VOUCH SYNC] Drain failed:', error);
        });
    }
  };

  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
