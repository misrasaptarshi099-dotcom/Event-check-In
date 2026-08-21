'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { createQrPayload, getRemainingSeconds } from '@/lib/security/totp';
import { CountdownRing } from '../ui/Progress';
import { StatusChip } from '../ui/StatusChip';

export interface DynamicQrCodeProps {
  registrationId: string;
  eventId: string;
  totpSecret: string;
  className?: string;
}

export function DynamicQrCode({
  registrationId,
  eventId,
  totpSecret,
  className,
}: DynamicQrCodeProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [remainingSecs, setRemainingSecs] = useState<number>(30);
  const [lastGeneratedTime, setLastGeneratedTime] = useState<string>('');
  const lastEpochRef = React.useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    lastEpochRef.current = null;

    const updateCode = async () => {
      if (!totpSecret || !registrationId || !eventId) return;

      const remaining = getRemainingSeconds();
      setRemainingSecs(remaining);

      const currentEpoch = Math.floor(Date.now() / 30_000);

      // Only re-encode the QR image when entering a new 30s TOTP epoch
      if (lastEpochRef.current !== currentEpoch) {
        // Generate serialized QR payload
        const payload = createQrPayload(registrationId, eventId, totpSecret);

        try {
          const url = await QRCode.toDataURL(payload, {
            width: 280,
            margin: 1,
            color: {
              dark: '#0F0F0F',
              light: '#FBF9F4',
            },
            errorCorrectionLevel: 'M',
          });

          if (active) {
            setQrDataUrl(url);
            setLastGeneratedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
            lastEpochRef.current = currentEpoch;
          }
        } catch (err) {
          console.error('QR generation error:', err);
        }
      }
    };

    // Initial generation
    updateCode();

    // 1-second interval to update countdown telemetry
    const interval = setInterval(() => {
      updateCode();
    }, 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [registrationId, eventId, totpSecret]);

  return (
    <div className={`flex flex-col items-center justify-center font-mono space-y-4 ${className || ''}`}>
      {/* QR Code Frame */}
      <div className="relative p-3 border-2 border-border-rigid bg-surface shadow-md">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt="Dynamic TOTP Admission QR"
            className="w-56 h-56 sm:w-64 sm:h-64 object-contain select-none"
          />
        ) : (
          <div className="w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center bg-surface-high animate-pulse text-xs text-muted-text">
            Generating Secure Token...
          </div>
        )}

        {/* Live Status Overlay Chip */}
        <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
          <StatusChip status="LIVE ROTATING TOKEN" variant="success" />
        </div>
      </div>

      {/* Countdown and Refresh Telemetry */}
      <div className="flex items-center gap-4 pt-2">
        <CountdownRing remainingSeconds={remainingSecs} totalSeconds={30} size={48} strokeWidth={3.5} />
        <div className="text-left">
          <div className="text-[11px] font-semibold text-primary">
            Refreshes every 30 seconds
          </div>
          <div className="text-[10px] text-muted-text">
            Screenshots expire instantly (RFC 6238)
          </div>
        </div>
      </div>

      {/* Timestamp Watermark */}
      <div className="text-[9px] text-muted-text uppercase tracking-widest text-center">
        Synced: {lastGeneratedTime || 'Connecting...'} · 1-Step Window
      </div>
    </div>
  );
}
