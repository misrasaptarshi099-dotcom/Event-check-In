import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface StatusChipProps {
  status: string;
  variant?: 'neutral' | 'success' | 'critical' | 'warning' | 'provisional';
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  variant = 'neutral',
  className,
}) => {
  const variantStyles = {
    neutral: 'border-border-rigid text-primary bg-transparent',
    success: 'border-border-rigid text-primary bg-surface-container font-semibold',
    critical: 'border-accent text-accent bg-accent/5 font-semibold',
    warning: 'border-amber-700 text-amber-900 bg-amber-50 font-semibold',
    provisional: 'border-amber-600 text-amber-800 bg-amber-100/50 italic',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border rounded-none select-none',
          variantStyles[variant],
          className
        )
      )}
    >
      {status}
    </span>
  );
};
