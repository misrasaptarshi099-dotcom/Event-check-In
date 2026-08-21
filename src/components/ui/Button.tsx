import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, children, disabled, ...props }, ref) => {
    const isBusy = Boolean(loading);
    const sizeClasses = {
      sm: 'h-10 px-4 text-xs font-mono tracking-wider',
      md: 'h-12 px-6 text-xs font-mono tracking-widest',
      lg: 'h-16 px-8 text-sm font-mono tracking-widest',
      xl: 'h-20 px-10 text-base font-mono tracking-widest',
    };

    const variantClasses = {
      primary:
        'bg-transparent border border-border-rigid text-primary hover:bg-primary hover:text-surface-high active:bg-primary active:text-surface transition-all duration-150',
      secondary:
        'bg-surface-container border border-border-rigid text-primary hover:bg-primary hover:text-surface-high transition-all duration-150',
      accent:
        'bg-accent border border-border-rigid text-white hover:bg-accent-hover active:bg-primary transition-all duration-150',
      outline:
        'bg-transparent border border-border-rigid text-primary hover:bg-surface-dim transition-all duration-150',
      ghost:
        'bg-transparent border-transparent text-primary hover:bg-surface-container transition-all duration-150',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isBusy}
        aria-busy={isBusy}
        className={twMerge(
          clsx(
            'relative inline-flex items-center justify-center uppercase font-medium select-none rounded-none focus:outline-none focus:ring-1 focus:ring-border-rigid disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer',
            sizeClasses[size],
            variantClasses[variant],
            className
          )
        )}
        {...props}
      >
        {isBusy ? (
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-3 border border-current animate-spin" />
            <span>PROCESSING...</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
