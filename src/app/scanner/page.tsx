'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CameraViewport } from '@/components/scanner/CameraViewport';
import { ScanResultOverlay } from '@/components/scanner/ScanResultOverlay';
import { Button, StatusChip, Modal } from '@/components/ui';
import { enqueueScan, getPendingScans } from '@/lib/offline/db';
import { drainOfflineQueue, registerAutoSync } from '@/lib/offline/syncManager';
import { getFreshAuthToken } from '@/lib/firebase/client';
import type { ScanOutcome, OfflineQueuedScan } from '@/types';

interface SyncFeedback {
  synced: number;
  conflicts: number;
  failed: number;
  error?: string;
}

export default function ScannerPage() {
  const [isScanning, setIsScanning] = useState(true);
  const [stationId, setStationId] = useState('Gate-A');
  const [isOnline, setIsOnline] = useState(true);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanOutcome[]>([]);
  const [syncFeedback, setSyncFeedback] = useState<SyncFeedback | null>(null);

  const refreshPending = React.useCallback(() => {
    getPendingScans().then((scans) => setPendingCount(scans.length)).catch(() => {});
  }, []);

  // Update online status & register sync listeners
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);

    const unregisterAutoSync = registerAutoSync(() => {
      refreshPending();
    });

    refreshPending();

    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      unregisterAutoSync();
    };
  }, [refreshPending]);

  const handleDrainQueue = async () => {
    setSyncing(true);
    setSyncFeedback(null);
    try {
      const results = await drainOfflineQueue();
      const remaining = await getPendingScans();
      setPendingCount(remaining.length);
      setSyncFeedback({
        synced: results.synced,
        conflicts: results.conflicts,
        failed: results.failed,
      });
    } catch (err: any) {
      setSyncFeedback({
        synced: 0,
        conflicts: 0,
        failed: 0,
        error: err.message || 'Sync failed.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const outcomeRef = React.useRef(outcome);
  outcomeRef.current = outcome;

  const handleScan = React.useCallback(async (rawDecodedText: string) => {
    // Prevent scanning while an outcome modal is active
    if (outcomeRef.current) return;

    try {
      let regId = '';
      let eventId = '';
      let otp = '';

      try {
        const parsed = JSON.parse(rawDecodedText);
        if (parsed && typeof parsed === 'object' && typeof parsed.r === 'string' && parsed.r.trim()) {
          regId = parsed.r.trim();
          eventId = typeof parsed.e === 'string' ? parsed.e.trim() : '';
          otp = typeof parsed.t === 'string' ? parsed.t.trim() : '';
        } else {
          regId = rawDecodedText.trim();
        }
      } catch {
        regId = rawDecodedText.trim();
      }

      const clientScanId = crypto.randomUUID();
      const now = new Date().toISOString();

      // If online: submit directly to real-time endpoint
      if (isOnline) {
        const token = await getFreshAuthToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch('/api/checkins/scan', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            rawQrPayload: rawDecodedText,
            stationId,
            clientScanId,
            eventId,
            registrationId: regId,
            otp,
          }),
        });

        const data = await res.json();
        let result: ScanOutcome;

        if (!res.ok) {
          result = {
            status: data.status || 'INVALID',
            message: data.message || data.error || 'Check-in validation rejected.',
            registrationId: data.registrationId || regId,
            attendeeName: data.attendeeName,
            checkedInAt: data.checkedInAt,
            stationId: data.stationId || stationId,
          };
        } else {
          result = data as ScanOutcome;
        }

        setOutcome(result);
        setScanHistory((prev) => [result, ...prev.slice(0, 20)]);
      } else {
        // Offline: Enqueue in IndexedDB for auto-sync on reconnect
        const offlineScan: OfflineQueuedScan = {
          clientScanId,
          eventId: eventId || 'offline_event',
          registrationId: regId,
          qrToken: regId,
          otp: otp || '',
          stationId,
          clientScannedAt: now,
          attendeeName: 'Queued Offline Scan',
          syncStatus: 'pending',
        };

        await enqueueScan(offlineScan);
        setPendingCount((prev) => prev + 1);

        const provisionalOutcome: ScanOutcome = {
          status: 'PROVISIONAL',
          message: 'Saved to offline queue. Will synchronize automatically on reconnect.',
          registrationId: regId,
          stationId,
          isOffline: true,
        };

        setOutcome(provisionalOutcome);
        setScanHistory((prev) => [provisionalOutcome, ...prev.slice(0, 20)]);
      }
    } catch (err: any) {
      setOutcome({
        status: 'INVALID',
        message: err.message || 'Scan verification failed.',
      });
    }
  }, [isOnline, stationId]);

  return (
    <div className="min-h-screen flex flex-col font-mono bg-surface text-primary">
      {/* Top Header */}
      <header className="border-b border-border-rigid px-6 md:px-12 flex items-center justify-between h-16 bg-surface">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-sm font-mono font-bold tracking-[0.25em] text-primary">
            VOUCH
          </span>
          <span className="text-[10px] font-mono text-muted-text">/</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-text">
            Gate Scanner PWA
          </span>
        </Link>

        {/* Network & Station Telemetry */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 border border-border-rigid bg-surface-high text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-[#15803D] animate-pulse' : 'bg-accent'
              }`}
            />
            <span className="font-semibold text-[10px] uppercase">
              {isOnline ? 'ONLINE' : 'OFFLINE MODE'}
            </span>
          </div>

          <Link href="/organizer">
            <Button variant="secondary" size="sm">
              Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Scanner Viewport */}
      <main className="flex-1 p-6 max-w-2xl w-full mx-auto space-y-6">
        {/* Station & Mode Configuration Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-border-rigid p-4 bg-surface-low">
          <div className="flex items-center gap-2">
            <label
              htmlFor="station-gate-select"
              className="text-[10px] uppercase tracking-widest text-muted-text font-semibold"
            >
              Assigned Gate:
            </label>
            <select
              id="station-gate-select"
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              className="bg-surface border border-border-rigid px-2 py-1 text-xs font-mono font-bold focus:outline-none rounded-none"
            >
              <option value="Gate-A">Gate A (Main Entrance)</option>
              <option value="Gate-B">Gate B (North Entry)</option>
              <option value="VIP-Desk">VIP / Press Desk</option>
              <option value="Mobile-Unit-1">Mobile Rover #1</option>
            </select>
          </div>

          {/* Offline Queue Badge & Drain Action */}
          {pendingCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-accent">
                ⚡ {pendingCount} offline queued
              </span>
              {isOnline && (
                <Button
                  variant="accent"
                  size="sm"
                  loading={syncing}
                  onClick={handleDrainQueue}
                  className="text-[10px] py-1 px-2"
                >
                  Sync Now
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Non-blocking Sync Feedback Modal */}
        <Modal
          isOpen={syncFeedback !== null}
          onClose={() => setSyncFeedback(null)}
          title="Queue Synchronization Report"
        >
          <div className="space-y-4 text-xs font-mono">
            {syncFeedback?.error ? (
              <div className="border border-accent bg-accent/10 p-3 text-accent space-y-1">
                <div className="font-bold">[!] Sync Error Encountered</div>
                <p className="text-[11px]">{syncFeedback.error}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border-rigid pb-2">
                  <span className="text-muted-text">Admissions Synced:</span>
                  <StatusChip status={`${syncFeedback?.synced ?? 0} SUCCESS`} variant="success" />
                </div>
                <div className="flex items-center justify-between border-b border-border-rigid pb-2">
                  <span className="text-muted-text">Multi-Station Conflicts:</span>
                  <StatusChip status={`${syncFeedback?.conflicts ?? 0} LOGGED`} variant={syncFeedback?.conflicts ? 'danger' : 'neutral'} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-text">Failed Invocations:</span>
                  <StatusChip status={`${syncFeedback?.failed ?? 0} FAILED`} variant={syncFeedback?.failed ? 'danger' : 'neutral'} />
                </div>
              </div>
            )}
            <div className="pt-2 flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setSyncFeedback(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </Modal>

        {/* Live Result Overlay or Viewport */}
        {outcome ? (
          <ScanResultOverlay
            outcome={outcome}
            onDismiss={() => setOutcome(null)}
          />
        ) : (
          <CameraViewport
            onScan={handleScan}
            isScanning={isScanning}
          />
        )}

        {/* Recent Scan History Ticker */}
        <div className="border border-border-rigid p-4 bg-surface space-y-3">
          <div className="flex items-center justify-between border-b border-border-rigid pb-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-text font-semibold">
              Recent Gate Admissions
            </span>
            <span className="text-[10px] text-muted-text">
              {scanHistory.length} Scans Logged
            </span>
          </div>

          {scanHistory.length === 0 ? (
            <p className="text-xs text-muted-text italic font-serif py-3 text-center">
              Awaiting first attendee scan. Aim camera at dynamic pass or enter token above.
            </p>
          ) : (
            <div className="divide-y divide-border-rigid text-xs space-y-1">
              {scanHistory.slice(0, 5).map((scan, idx) => (
                <div key={idx} className="py-1.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-primary">{scan.attendeeName || scan.registrationId}</span>
                    <span className="text-[10px] text-muted-text ml-2">{scan.stationId}</span>
                  </div>
                  <StatusChip
                    status={scan.status}
                    variant={scan.status === 'CONFIRMED' ? 'success' : scan.status === 'PROVISIONAL' ? 'neutral' : 'danger'}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
