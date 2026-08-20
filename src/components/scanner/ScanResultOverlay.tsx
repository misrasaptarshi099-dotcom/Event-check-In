'use client';

import React from 'react';
import { clsx } from 'clsx';
import { Button } from '../ui/Button';
import type { ScanOutcome } from '@/types';

export interface ScanResultOverlayProps {
  outcome: ScanOutcome | null;
  onDismiss: () => void;
}

export function ScanResultOverlay({ outcome, onDismiss }: ScanResultOverlayProps) {
  if (!outcome) return null;

  const isConfirmed = outcome.status === 'CONFIRMED';
  const isDuplicate = outcome.status === 'DUPLICATE' || outcome.status === 'CONFLICT';
  const isInvalid = outcome.status === 'INVALID';

  const bgStyles = {
    CONFIRMED: 'bg-[#15803D] text-surface',
    DUPLICATE: 'bg-[#D97706] text-surface',
    CONFLICT: 'bg-[#D97706] text-surface',
    INVALID: 'bg-accent text-surface',
    PROVISIONAL: 'bg-[#2563EB] text-surface',
  }[outcome.status] || 'bg-primary text-surface';

  return (
    <div
      role="alert"
      className={clsx(
        'border-2 border-border-rigid p-6 font-mono shadow-2xl space-y-4 animate-in zoom-in-95 duration-150',
        bgStyles
      )}
    >
      <div className="flex items-center justify-between border-b border-surface/30 pb-3">
        <span className="text-xl font-bold tracking-widest uppercase">
          {outcome.status === 'CONFIRMED' && '✓ ADMITTED'}
          {outcome.status === 'DUPLICATE' && '⚠ DUPLICATE DETECTED'}
          {outcome.status === 'CONFLICT' && '⚠ CONFLICT DETECTED'}
          {outcome.status === 'INVALID' && '✕ ACCESS DENIED'}
        </span>
        <button
          onClick={onDismiss}
          className="text-surface hover:bg-surface/20 w-8 h-8 flex items-center justify-center font-bold border border-surface/40"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-base font-serif italic font-medium leading-snug">
          {outcome.message}
        </p>

        {outcome.attendeeName && (
          <div className="bg-surface/10 p-3 border border-surface/20 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="opacity-80">Attendee:</span>
              <span className="font-bold">{outcome.attendeeName}</span>
            </div>
            {outcome.registrationId && (
              <div className="flex justify-between">
                <span className="opacity-80">Registration ID:</span>
                <span className="font-mono text-[10px]">{outcome.registrationId}</span>
              </div>
            )}
            {outcome.checkedInAt && (
              <div className="flex justify-between">
                <span className="opacity-80">Timestamp:</span>
                <span>{new Date(outcome.checkedInAt).toLocaleTimeString()}</span>
              </div>
            )}
            {outcome.stationId && (
              <div className="flex justify-between">
                <span className="opacity-80">Station:</span>
                <span>{outcome.stationId}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <Button
        variant="secondary"
        size="md"
        onClick={onDismiss}
        className="w-full bg-surface text-primary hover:bg-surface-high font-bold uppercase tracking-wider"
      >
        Ready For Next Scan
      </Button>
    </div>
  );
}
