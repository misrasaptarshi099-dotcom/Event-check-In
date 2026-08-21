'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface ProgressBarProps {
  value: number; // 0 to 100
  label?: string;
  sublabel?: string;
  variant?: 'primary' | 'accent' | 'success';
  height?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ProgressBar({
  value,
  label,
  sublabel,
  variant = 'primary',
  height = 'md',
  className,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-3',
    lg: 'h-5',
  };

  const fillColors = {
    primary: 'bg-primary',
    accent: 'bg-accent',
    success: 'bg-[#15803D]',
  };

  return (
    <div className={clsx('w-full font-mono space-y-1.5', className)}>
      {(label || sublabel) && (
        <div className="flex items-center justify-between text-[11px]">
          {label && <span className="uppercase tracking-widest text-muted-text">{label}</span>}
          {sublabel && <span className="font-semibold tabular-nums text-primary">{sublabel}</span>}
        </div>
      )}
      <div className={clsx('w-full bg-surface-highest border border-border-rigid p-0.5', heightClasses[height])}>
        <div
          className={clsx('h-full transition-all duration-300', fillColors[variant])}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export interface CountdownRingProps {
  remainingSeconds: number;
  totalSeconds?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function CountdownRing({
  remainingSeconds,
  totalSeconds = 30,
  size = 56,
  strokeWidth = 4,
  className,
}: CountdownRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, Math.max(0, remainingSeconds / totalSeconds));
  const strokeDashoffset = circumference * (1 - progress);

  const isExpiringSoon = remainingSeconds <= 5;

  return (
    <div className={clsx('relative inline-flex items-center justify-center font-mono', className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--surface-highest)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress stroke */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isExpiringSoon ? 'var(--accent)' : 'var(--primary)'}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="square"
          fill="transparent"
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={clsx(
            'text-xs font-bold tabular-nums',
            isExpiringSoon ? 'text-accent animate-pulse' : 'text-primary'
          )}
        >
          {remainingSeconds}s
        </span>
      </div>
    </div>
  );
}
