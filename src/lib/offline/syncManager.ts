import {
  getPendingScans,
  getRecoverableScans,
  updateScanStatus,
  clearSyncedScans,
} from './db';
import { getFreshAuthToken } from '@/lib/firebase/client';
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
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes a full sync drain cycle.
 *
 * Returns a summary of synced, conflicting, and failed records.
 */
export async function drainSyncQueue(): Promise<{
  total: number;
  synced: number;
  conflicts: number;
  failed: number;
  remaining: number;
}> {
  // Step 1: Recover scans interrupted during previous sync attempts or previous failures
  await recoverInterruptedScans();

  // Step 2: Read all pending scans
  const pending = await getPendingScans();
  const total = pending.length;
  if (total === 0) {
    return { total: 0, synced: 0, conflicts: 0, failed: 0, remaining: 0 };
  }

  let synced = 0;
  let conflicts = 0;
  let failed = 0;

  // Step 3: Process each scan sequentially to maintain order
  for (const scan of pending) {
    const result = await syncSingleScan(scan);
    if (result === 'success') synced++;
    else if (result === 'duplicate_conflict') conflicts++;
    else failed++;
  }

  // Step 4: Clean up successfully synced entries
  await clearSyncedScans();

  const remaining = (await getPendingScans()).length;

  return { total, synced, conflicts, failed, remaining };
}

export const drainOfflineQueue = drainSyncQueue;

/**
 * Recovers scans stuck in 'syncing' or 'failed' status so they are re-queued.
 */
export async function recoverInterruptedScans(): Promise<number> {
  const recoverable = await getRecoverableScans();
  for (const scan of recoverable) {
    await updateScanStatus(scan.clientScanId, 'pending');
  }
  return recoverable.length;
}

/**
 * Attempts to sync a single scan with exponential backoff.
 */
async function syncSingleScan(
  scan: OfflineQueuedScan,
  attempt = 1
): Promise<SyncResult> {
  await updateScanStatus(scan.clientScanId, 'syncing');

  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const token = await getFreshAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    response = await fetch(SYNC_ENDPOINT, {
      method: 'POST',
      headers,
      signal: controller.signal,
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
  } catch (networkError) {
    clearTimeout(timeoutId);

    // Network failure — retry with jittered backoff
    if (attempt < MAX_RETRIES) {
      const jitter = Math.floor(Math.random() * 500);
      await delay(RETRY_DELAY_MS * attempt + jitter);
      return syncSingleScan(scan, attempt + 1);
    }

    await updateScanStatus(scan.clientScanId, 'failed', 'error');
    return 'error';
  } finally {
    clearTimeout(timeoutId);
  }

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

  // 5xx server error — retry with jitter
  if (attempt < MAX_RETRIES) {
    const jitter = Math.floor(Math.random() * 500);
    await delay(RETRY_DELAY_MS * attempt + jitter);
    return syncSingleScan(scan, attempt + 1);
  }

  await updateScanStatus(scan.clientScanId, 'failed', 'error');
  return 'error';
}

/**
 * Registers a listener for online/offline events to auto-trigger sync.
 */
export function registerAutoSync(
  onComplete?: (results: { total: number; synced: number; conflicts: number; failed: number }) => void
): () => void {
  const handler = () => {
    if (navigator.onLine) {
      console.log('[VOUCH SYNC] Network restored — draining offline queue...');
      drainOfflineQueue()
        .then((results) => {
          console.log('[VOUCH SYNC] Drain complete:', results);
          if (onComplete) onComplete(results);
        })
        .catch((error) => {
          console.error('[VOUCH SYNC] Drain failed:', error);
        });
    }
  };

  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
