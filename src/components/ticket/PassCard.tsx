'use client';

import React from 'react';
import { clsx } from 'clsx';
import { DynamicQrCode } from './DynamicQrCode';
import { StatusChip } from '../ui/StatusChip';
import { formatCurrency } from '@/lib/utils/format';
import type { EventItem, Registration } from '@/types';

export interface PassCardProps {
  event: EventItem;
  registration: Registration;
  className?: string;
}

export function PassCard({ event, registration, className }: PassCardProps) {
  const now = Date.now();
  const eventStartMs = new Date(event.eventDate).getTime();
  const checkinOpenMs = eventStartMs - (30 * 60 * 1000);
  const isGateOpen = now >= checkinOpenMs;

  const isEnded = event.eventEndDate
    ? new Date(event.eventEndDate).getTime() <= now
    : (event.eventDate ? new Date(event.eventDate).getTime() <= now : false);

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
        isEnded && 'opacity-95',
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
            <StatusChip
              status={isEnded ? 'EXPIRED' : 'OFFICIAL PASS'}
              variant={isEnded ? 'danger' : 'neutral'}
            />
          </div>
        </div>
      ) : (
        <div className="h-16 bg-primary border-b border-border-rigid flex items-center justify-between px-6">
          <span className="text-xs uppercase tracking-[0.25em] text-surface font-bold">
            VOUCH VERIFIED PASS
          </span>
          <StatusChip
            status={isEnded ? 'EXPIRED' : 'ACTIVE'}
            variant={isEnded ? 'danger' : 'success'}
          />
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
              {(registration.guestCount || 1) > 1 && ` (+${(registration.guestCount || 1) - 1} Guests)`}
            </span>
            <span className="text-[10px] text-muted-text truncate block">
              {registration.attendeeEmail}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[9px] uppercase tracking-widest text-muted-text block">
              RESERVATION · {registration.guestCount || 1} SEAT{(registration.guestCount || 1) > 1 ? 'S' : ''}
            </span>
            <span className="font-mono text-[10px] font-bold text-primary block truncate">
              {registration.id}
            </span>
            <span className="text-[10px] text-muted-text block">
              {(() => {
                const seats = registration.guestCount || 1;
                const unitPrice = registration.ticketPrice !== undefined ? registration.ticketPrice : (event.ticketPrice || 0);
                const totalPaid = unitPrice * seats;
                return totalPaid > 0
                  ? `${formatCurrency(totalPaid, event.currency)} Paid`
                  : 'Free Admission';
              })()}
            </span>
          </div>
        </div>

        {/* Perforation Divider */}
        <div className="relative py-2 flex items-center justify-center">
          <div className="w-full border-b-2 border-dashed border-border-rigid" />
          <div className="absolute -left-9 w-6 h-6 rounded-full bg-surface-highest border border-border-rigid" />
          <div className="absolute -right-9 w-6 h-6 rounded-full bg-surface-highest border border-border-rigid" />
        </div>

        {/* Dynamic Rotating QR or Still Expired Notice */}
        {isEnded ? (
          <div className="py-2 space-y-4">
            <div className="py-8 px-4 border-2 border-border-rigid bg-surface-container text-center space-y-3">
              <div className="text-4xl opacity-70">🎟️</div>
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-widest text-accent block">
                  EVENT CONCLUDED · PASS EXPIRED
                </span>
                <p className="text-[11px] text-muted-text max-w-xs mx-auto">
                  This event has ended and gate admission is closed. Rotating cryptographic TOTP tokens are deactivated.
                </p>
              </div>
            </div>

            <div className="border border-border-rigid bg-surface-high p-3 text-center space-y-1">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-text">
                ARCHIVED ADMISSION RECORD
              </p>
              <p className="text-[9px] text-muted-text">
                This card remains permanently in your account as your verified registration receipt.
              </p>
            </div>
          </div>
        ) : (
          <>
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
                {isGateOpen ? '⚡ DO NOT SCREENSHOT' : '⏳ GATE ADMISSION PENDING'}
              </p>
              <p className="text-[9px] text-muted-text">
                {isGateOpen
                  ? 'Security tokens rotate dynamically on a 30s cryptographic epoch. Static screenshots will fail at the gate.'
                  : 'Gate scanning and ticket verification open 30 minutes prior to event start time.'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Footer Strip */}
      <div className="border-t border-border-rigid px-6 py-3 bg-surface-high flex items-center justify-between text-[9px] text-muted-text uppercase tracking-wider">
        <span>{isEnded ? 'VOUCH OS // ARCHIVED' : 'VOUCH OS // RFC 6238'}</span>
        <span>ID: {registration.id.slice(-8)}</span>
      </div>
    </div>
  );
}
