import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col space-y-1.5 font-mono">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[10px] uppercase tracking-widest text-muted-text font-medium"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={twMerge(
              clsx(
                'w-full h-14 bg-transparent border-b border-border-rigid px-0 py-2 text-lg font-serif italic text-primary placeholder:text-muted-text/50 placeholder:font-mono placeholder:not-italic placeholder:text-sm focus:outline-none focus:border-b-2 focus:border-primary transition-all duration-150 rounded-none',
                error && 'border-accent focus:border-accent text-accent',
                className
              )
            )}
            {...props}
          />
        </div>
        {hint && !error && (
          <span className="text-[11px] text-muted-text">{hint}</span>
        )}
        {error && (
          <span className="text-[11px] text-accent font-medium tracking-wide flex items-center gap-1">
            <span>[!]</span> {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
