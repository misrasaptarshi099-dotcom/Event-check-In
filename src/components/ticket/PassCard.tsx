'use client';

import React from 'react';
import { clsx } from 'clsx';
import { DynamicQrCode } from './DynamicQrCode';
import { StatusChip } from '../ui/StatusChip';
import type { EventItem, Registration } from '@/types';

export interface PassCardProps {
  event: EventItem;
  registration: Registration;
  className?: string;
}

export function PassCard({ event, registration, className }: PassCardProps) {
  const formattedDate = new Date(event.eventDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedTime = new Date(event.eventDate).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={clsx(
        'w-full max-w-md mx-auto bg-surface border-2 border-border-rigid shadow-2xl font-mono relative overflow-hidden',
        className
      )}
    >
      {/* Banner Image Header */}
      {event.bannerUrl ? (
        <div className="relative h-40 w-full border-b border-border-rigid overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.bannerUrl}
            alt={event.name}
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
          <div className="absolute top-3 right-3">
            <StatusChip status="OFFICIAL PASS" variant="neutral" />
          </div>
        </div>
      ) : (
        <div className="h-16 bg-primary border-b border-border-rigid flex items-center justify-between px-6">
          <span className="text-xs uppercase tracking-[0.25em] text-surface font-bold">
            VOUCH VERIFIED PASS
          </span>
          <StatusChip status="ACTIVE" variant="success" />
        </div>
      )}

      {/* Main Event Header */}
      <div className="p-6 space-y-4">
        <div>
          <p className="text-[10px] text-muted-text uppercase tracking-widest">
            {formattedDate} · {formattedTime} {event.timezone ? `(${event.timezone})` : ''}
          </p>
          <h2 className="text-2xl sm:text-3xl font-serif italic text-primary tracking-tight font-medium mt-1">
            {event.name}
          </h2>
          {event.venue && (
            <p className="text-xs text-muted-text mt-1 flex items-center gap-1">
              <span>📍</span> {event.venue}
            </p>
          )}
        </div>

        {/* Attendee Details Grid */}
        <div className="grid grid-cols-2 gap-3 border-y border-border-rigid py-3 text-xs">
          <div>
            <span className="text-[9px] uppercase tracking-widest text-muted-text block">
              ADMIT TO
            </span>
            <span className="font-semibold text-primary truncate block">
              {registration.attendeeName}
            </span>
            <span className="text-[10px] text-muted-text truncate block">
              {registration.attendeeEmail}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[9px] uppercase tracking-widest text-muted-text block">
              REGISTRATION ID
            </span>
            <span className="font-mono text-[10px] font-bold text-primary block truncate">
              {registration.id}
            </span>
            <span className="text-[10px] text-muted-text block">
              {registration.ticketPrice ? `$${registration.ticketPrice} Paid` : 'Standard Admission'}
            </span>
          </div>
        </div>

        {/* Perforation Divider */}
        <div className="relative py-2 flex items-center justify-center">
          <div className="w-full border-b-2 border-dashed border-border-rigid" />
          <div className="absolute -left-9 w-6 h-6 rounded-full bg-surface-highest border border-border-rigid" />
          <div className="absolute -right-9 w-6 h-6 rounded-full bg-surface-highest border border-border-rigid" />
        </div>

        {/* Dynamic Rotating QR Section */}
        <div className="py-2">
          <DynamicQrCode
            registrationId={registration.id}
            eventId={event.id}
            totpSecret={registration.totpSecret}
          />
        </div>

        {/* Security Anti-Screenshot Banner */}
        <div className="border border-border-rigid bg-surface-high p-3 text-center space-y-1">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-accent">
            ⚡ DO NOT SCREENSHOT
          </p>
          <p className="text-[9px] text-muted-text">
            Security tokens rotate dynamically on a 30s cryptographic epoch. Static screenshots will fail at the gate.
          </p>
        </div>
      </div>

      {/* Footer Strip */}
      <div className="border-t border-border-rigid px-6 py-3 bg-surface-high flex items-center justify-between text-[9px] text-muted-text uppercase tracking-wider">
        <span>VOUCH OS // RFC 6238</span>
        <span>ID: {registration.id.slice(-8)}</span>
      </div>
    </div>
  );
}
