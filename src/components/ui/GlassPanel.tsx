import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'dock' | 'inverted';
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  className,
  variant = 'default',
  children,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-white/40 backdrop-blur-md border border-border-rigid',
    dock: 'bg-surface/90 backdrop-blur-xl border border-border-rigid shadow-sm',
    inverted: 'bg-primary/95 text-surface-high backdrop-blur-xl border border-border-rigid',
  };

  return (
    <div
      className={twMerge(
        clsx('rounded-none transition-all duration-150', variantStyles[variant], className)
      )}
      {...props}
    >
      {children}
    </div>
  );
};
