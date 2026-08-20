'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CameraViewport } from '@/components/scanner/CameraViewport';
import { ScanResultOverlay } from '@/components/scanner/ScanResultOverlay';
import { Button, StatusChip, Tabs } from '@/components/ui';
import { enqueueScan, getPendingScans } from '@/lib/offline/db';
import { drainOfflineQueue, registerAutoSync } from '@/lib/offline/syncManager';
import type { ScanOutcome, OfflineQueuedScan } from '@/types';

export default function ScannerPage() {
  const [isScanning, setIsScanning] = useState(true);
  const [stationId, setStationId] = useState('Gate-A');
  const [isOnline, setIsOnline] = useState(true);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanOutcome[]>([]);

  // Update online status & register sync listeners
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);

    const unregisterAutoSync = registerAutoSync();

    // Check pending count in IndexedDB
    getPendingScans().then((scans) => setPendingCount(scans.length)).catch(() => {});

    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      unregisterAutoSync();
    };
  }, []);

  const handleDrainQueue = async () => {
    setSyncing(true);
    try {
      const results = await drainOfflineQueue();
      const remaining = await getPendingScans();
      setPendingCount(remaining.length);
      alert(`Sync Complete: ${results.synced} synced, ${results.conflicts} conflicts logged, ${results.failed} failed.`);
    } catch (err: any) {
      alert(`Sync error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleScan = async (rawDecodedText: string) => {
    // Prevent scanning while an outcome modal is active
    if (outcome) return;

    try {
      let regId = '';
      let eventId = '';
      let otp = '';

      try {
        const parsed = JSON.parse(rawDecodedText);
        regId = parsed.r;
        eventId = parsed.e;
        otp = parsed.t;
      } catch {
        regId = rawDecodedText.trim();
      }

      const clientScanId = crypto.randomUUID();
      const now = new Date().toISOString();

      // If online: submit directly to real-time endpoint
      if (isOnline) {
        const res = await fetch('/api/checkins/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawQrPayload: rawDecodedText,
            stationId,
            clientScanId,
            eventId,
            registrationId: regId,
            otp,
          }),
        });

        const result: ScanOutcome = await res.json();
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
  };

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
            <span className="text-[10px] uppercase tracking-widest text-muted-text font-semibold">
              Assigned Gate:
            </span>
            <select
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
