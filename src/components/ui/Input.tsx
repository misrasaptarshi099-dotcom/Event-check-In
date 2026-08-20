import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, 'aria-describedby': ariaDescribedBy, ...props }, ref) => {
    const fallbackId = React.useId();
    const inputId = id || fallbackId;
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;

    // Compose aria-describedby from hint, error, and any caller-provided value
    const describedByParts: string[] = [];
    if (ariaDescribedBy) describedByParts.push(ariaDescribedBy);
    if (hint && !error) describedByParts.push(hintId);
    if (error) describedByParts.push(errorId);
    const composedDescribedBy = describedByParts.length > 0 ? describedByParts.join(' ') : undefined;

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
            aria-invalid={error ? true : undefined}
            aria-describedby={composedDescribedBy}
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
          <span id={hintId} className="text-[11px] text-muted-text">{hint}</span>
        )}
        {error && (
          <span id={errorId} role="alert" className="text-[11px] text-accent font-medium tracking-wide flex items-center gap-1">
            <span>[!]</span> {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
