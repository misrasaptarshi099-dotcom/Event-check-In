'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface MetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: string;
  variant?: 'neutral' | 'accent' | 'success';
  className?: string;
}

export function MetricCard({
  label,
  value,
  sublabel,
  trend,
  variant = 'neutral',
  className,
}: MetricCardProps) {
  const borderVariants = {
    neutral: 'border-border-rigid',
    accent: 'border-accent bg-accent/5',
    success: 'border-[#15803D] bg-[#15803D]/5',
  };

  const textVariants = {
    neutral: 'text-primary',
    accent: 'text-accent',
    success: 'text-[#15803D]',
  };

  return (
    <div
      className={clsx(
        'border p-5 bg-surface font-mono flex flex-col justify-between transition-all duration-150',
        borderVariants[variant],
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-muted-text font-medium">
          {label}
        </span>
        {trend && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 border border-border-rigid bg-surface-high">
            {trend}
          </span>
        )}
      </div>

      <div className="my-3">
        <span
          className={clsx(
            'text-3xl sm:text-4xl font-serif italic tracking-tight font-medium tabular-nums',
            textVariants[variant]
          )}
        >
          {value}
        </span>
      </div>

      {sublabel && (
        <div className="text-[11px] text-muted-text border-t border-border-rigid/40 pt-2 mt-1">
          {sublabel}
        </div>
      )}
    </div>
  );
}
