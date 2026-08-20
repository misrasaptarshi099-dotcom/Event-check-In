'use client';

import React, { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '../ui/Button';

export interface CameraViewportProps {
  onScan: (decodedText: string) => void;
  isScanning: boolean;
  className?: string;
}

export function CameraViewport({ onScan, isScanning, className }: CameraViewportProps) {
  const [scannerReady, setScannerReady] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [manualInput, setManualInput] = useState('');
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const elementId = 'vouch-reader';
    const scanner = new Html5Qrcode(elementId);
    html5QrCodeRef.current = scanner;

    const startScanner = async () => {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const cameraId = cameras[cameras.length - 1].id; // Prefer back camera
          await scanner.start(
            cameraId,
            {
              fps: 15,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0,
            },
            (decodedText) => {
              onScan(decodedText);
            },
            () => {
              // Ignore frame scan failures
            }
          );
          setScannerReady(true);
        } else {
          setHasCamera(false);
        }
      } catch (err) {
        console.warn('Camera access not granted or unavailable:', err);
        setHasCamera(false);
      }
    };

    if (isScanning) {
      startScanner();
    }

    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, [isScanning, onScan]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      setManualInput('');
    }
  };

  return (
    <div className={clsx('w-full font-mono space-y-3', className)}>
      <div className="relative border-2 border-border-rigid bg-primary min-h-[300px] flex flex-col items-center justify-center overflow-hidden">
        {/* Camera container */}
        <div id="vouch-reader" className="w-full max-w-sm h-full" />

        {/* Viewfinder Target Reticle */}
        {hasCamera && isScanning && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-60 h-60 border-2 border-dashed border-surface/80 relative animate-pulse">
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-accent" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-accent" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-accent" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-accent" />
            </div>
          </div>
        )}

        {!hasCamera && (
          <div className="p-8 text-center text-surface space-y-2">
            <div className="text-3xl">📷</div>
            <p className="text-sm font-semibold">Camera Access Unavailable</p>
            <p className="text-[11px] text-surface-dim max-w-xs mx-auto">
              Please ensure camera permissions are enabled in your browser, or use manual entry below.
            </p>
          </div>
        )}
      </div>

      {/* Manual Payload / Token Entry Fallback */}
      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <input
          type="text"
          placeholder="Paste or type raw QR payload / token JSON..."
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          className="flex-1 h-11 bg-surface border border-border-rigid px-3 text-xs font-mono text-primary placeholder:text-muted-text focus:outline-none focus:border-b-2 focus:border-primary rounded-none"
        />
        <Button type="submit" variant="primary" size="md">
          Verify Token
        </Button>
      </form>
    </div>
  );
}
