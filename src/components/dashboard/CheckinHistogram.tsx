'use client';

import React from 'react';
import { clsx } from 'clsx';
import type { CheckinTimeBucket } from '@/types';

export interface CheckinHistogramProps {
  buckets: CheckinTimeBucket[];
  peakBucket?: string;
  peakCount?: number;
  className?: string;
}

export function CheckinHistogram({
  buckets,
  peakBucket,
  peakCount,
  className,
}: CheckinHistogramProps) {
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className={clsx('border border-border-rigid p-6 bg-surface font-mono space-y-4', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-rigid pb-4">
        <div>
          <h4 className="text-sm font-serif italic text-primary font-medium tracking-tight">
            Check-In Velocity Distribution
          </h4>
          <p className="text-[10px] text-muted-text uppercase tracking-widest mt-0.5">
            15-Minute Interval Rush Density
          </p>
        </div>
        {peakBucket && peakBucket !== 'N/A' && (
          <div className="text-[11px] px-2.5 py-1 border border-border-rigid bg-surface-high flex items-center gap-2">
            <span className="text-muted-text uppercase">Peak Rush:</span>
            <span className="font-bold text-accent">{peakBucket} ({peakCount} scans)</span>
          </div>
        )}
      </div>

      {buckets.length === 0 ? (
        <div className="py-12 text-center text-muted-text font-serif italic text-sm">
          No check-in scans recorded yet. Live distribution will plot as gates admit attendees.
        </div>
      ) : (
        <div className="space-y-2 pt-2">
          <div className="flex items-end gap-1.5 h-48 w-full border-b border-border-rigid pb-1 overflow-x-auto">
            {buckets.map((b) => {
              const heightPct = Math.round((b.count / maxCount) * 100);
              const isPeak = b.bucket === peakBucket;

              return (
                <div
                  key={b.bucket}
                  tabIndex={0}
                  role="img"
                  aria-label={`${b.bucket}: ${b.count} check-ins${isPeak ? ' (peak volume)' : ''}`}
                  className="flex-1 min-w-[32px] flex flex-col items-center justify-end h-full group relative focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {/* Tooltip */}
                  <div className="absolute -top-8 bg-primary text-surface text-[10px] px-1.5 py-0.5 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    {b.bucket}: {b.count} check-ins
                  </div>

                  {/* Bar */}
                  <div
                    style={{ height: `${Math.max(4, heightPct)}%` }}
                    className={clsx(
                      'w-full border border-border-rigid transition-all duration-300',
                      isPeak
                        ? 'bg-accent border-accent shadow-sm'
                        : 'bg-primary hover:bg-muted-text'
                    )}
                  />
                  {/* Bucket Label */}
                  <span className="text-[9px] text-muted-text transform -rotate-45 mt-2 origin-top-left font-mono">
                    {b.bucket}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
