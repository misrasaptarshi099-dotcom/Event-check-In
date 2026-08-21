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
  const isEventCancelled = event.status === 'cancelled';
  const isCancelled = registration.status === 'cancelled' || isEventCancelled;
  const eventStartMs = new Date(event.eventDate).getTime();
  const checkinOpenMs = eventStartMs - (30 * 60 * 1000);
  const isGateOpen = now >= checkinOpenMs;

  const isEnded = event.eventEndDate
    ? new Date(event.eventEndDate).getTime() <= now
    : false;

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

  const seats = registration.guestCount || 1;
  const unitPrice = registration.ticketPrice !== undefined ? registration.ticketPrice : (event.ticketPrice || 0);
  const totalAmount = unitPrice * seats;

  return (
    <div
      className={clsx(
        'w-full max-w-md mx-auto bg-surface border-2 border-border-rigid shadow-2xl font-mono relative overflow-hidden',
        (isEnded || isCancelled) && 'opacity-95',
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
            className={clsx("w-full h-full object-cover object-center", isCancelled && "grayscale contrast-125")}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
          <div className="absolute top-3 right-3">
            <StatusChip
              status={
                isCancelled
                  ? 'CANCELLED · REFUNDED'
                  : registration.checkedIn
                  ? 'ADMITTED · VERIFIED'
                  : isEnded
                  ? 'EXPIRED'
                  : 'OFFICIAL PASS'
              }
              variant={isCancelled || isEnded ? 'danger' : registration.checkedIn ? 'success' : 'neutral'}
            />
          </div>
        </div>
      ) : (
        <div className={clsx(
          "h-16 border-b border-border-rigid flex items-center justify-between px-6",
          isCancelled ? "bg-accent/15" : registration.checkedIn ? "bg-surface-low border-b-2 border-primary" : "bg-primary"
        )}>
          <span className={clsx(
            "text-xs uppercase tracking-[0.25em] font-bold",
            isCancelled ? "text-accent" : registration.checkedIn ? "text-primary" : "text-surface"
          )}>
            {isCancelled ? 'CANCELLED RESERVATION' : registration.checkedIn ? 'ADMITTED PASS' : 'VOUCH VERIFIED PASS'}
          </span>
          <StatusChip
            status={
              isCancelled
                ? 'CANCELLED · REFUNDED'
                : registration.checkedIn
                ? 'ADMITTED'
                : isEnded
                ? 'EXPIRED'
                : 'ACTIVE'
            }
            variant={isCancelled || isEnded ? 'danger' : 'success'}
          />
        </div>
      )}

      {/* Main Event Header */}
      <div className="p-6 space-y-4">
        <div>
          <p className="text-[10px] text-muted-text uppercase tracking-widest">
            {formattedDate} · {formattedTime} {event.timezone ? `(${event.timezone})` : ''}
          </p>
          <h2 className={clsx(
            "text-2xl sm:text-3xl font-serif italic tracking-tight font-medium mt-1",
            isCancelled ? "text-muted-text line-through" : "text-primary"
          )}>
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
              {seats > 1 && ` (+${seats - 1} Guests)`}
            </span>
            <span className="text-[10px] text-muted-text truncate block">
              {registration.attendeeEmail}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[9px] uppercase tracking-widest text-muted-text block">
              RESERVATION · {seats} SEAT{seats > 1 ? 'S' : ''}
            </span>
            <span className="font-mono text-[10px] font-bold text-primary block truncate">
              {registration.id}
            </span>
            <span className={clsx("text-[10px] block font-bold", isCancelled ? "text-accent" : "text-muted-text")}>
              {isCancelled ? (
                totalAmount > 0
                  ? `₹${totalAmount.toLocaleString()} Refunded`
                  : 'Reservation Cancelled'
              ) : (
                totalAmount > 0
                  ? `${formatCurrency(totalAmount, event.currency)} Paid`
                  : 'Free Admission'
              )}
            </span>
          </div>
        </div>

        {/* Perforation Divider */}
        <div className="relative py-2 flex items-center justify-center">
          <div className="w-full border-b-2 border-dashed border-border-rigid" />
          <div className="absolute -left-9 w-6 h-6 rounded-full bg-surface-highest border border-border-rigid" />
          <div className="absolute -right-9 w-6 h-6 rounded-full bg-surface-highest border border-border-rigid" />
        </div>

        {/* Dynamic Rotating QR or Cancelled / Admitted / Expired Notice */}
        {isCancelled ? (
          <div className="py-2 space-y-4">
            <div className="py-6 px-4 border-2 border-dashed border-accent/40 bg-accent/5 text-center space-y-3">
              <div className="text-3xl">🚫</div>
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-widest text-accent block">
                  {isEventCancelled ? 'EVENT CANCELLED BY HOST' : 'RESERVATION CANCELLED & REFUNDED'}
                </span>
                <p className="text-[11px] text-muted-text max-w-xs mx-auto">
                  {isEventCancelled
                    ? `This event was cancelled. ${seats} ticket seat(s) have been fully refunded.`
                    : `This pass has been deactivated. ${seats} reserved seat(s) were restored to the event capacity.`}
                </p>
                {(event.cancellationReason || registration.cancelledAt) && (
                  <div className="pt-2 text-left space-y-1.5 border-t border-accent/20 mt-3">
                    {event.cancellationReason && (
                      <div className="p-3 bg-surface border border-accent/40 space-y-1">
                        <span className="text-[9px] uppercase font-bold text-accent tracking-wider block">
                          Apology & Reason from Organizer:
                        </span>
                        <p className="text-xs text-primary font-serif italic leading-relaxed">
                          &ldquo;{event.cancellationReason}&rdquo;
                        </p>
                      </div>
                    )}
                    {registration.cancelledAt && (
                      <p className="text-[10px] text-muted-text font-mono">
                        Cancelled: {new Date(registration.cancelledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="border border-border-rigid bg-surface-high p-3 text-center space-y-1">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-text">
                FULL REFUND RECEIPT RECORD
              </p>
              <p className="text-[9px] text-muted-text">
                {totalAmount > 0
                  ? `Full refund of ${formatCurrency(totalAmount, event.currency)} logged and returned.`
                  : 'Free reservation seat returned to the organizer inventory.'}
              </p>
            </div>
          </div>
        ) : registration.checkedIn ? (
          <div className="py-2 space-y-4">
            <div className="py-8 px-4 border-2 border-border-rigid bg-surface-low text-center space-y-3 shadow-inner">
              <div className="w-12 h-12 mx-auto border-2 border-primary bg-primary text-surface flex items-center justify-center text-xl font-bold">
                ✓
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-widest text-primary block">
                  ADMITTED AT GATE
                </span>
                <p className="text-[11px] text-muted-text max-w-xs mx-auto">
                  Admission pass validated and entry granted. Single-use dynamic QR token has been consumed and locked.
                </p>
                {registration.checkedInAt && (
                  <p className="text-[10px] text-muted-text font-mono pt-1">
                    Admitted: {new Date(registration.checkedInAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                )}
              </div>
            </div>

            <div className="border border-border-rigid bg-surface-high p-3 text-center space-y-1">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-primary">
                OFFICIAL ADMISSION RECORD
              </p>
              <p className="text-[9px] text-muted-text">
                This pass has already been admitted at the gate. It cannot be cancelled, transferred, or scanned again.
              </p>
            </div>
          </div>
        ) : isEnded ? (
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
        <span>
          {isCancelled
            ? 'VOUCH OS // VOID'
            : registration.checkedIn
            ? 'VOUCH OS // ADMITTED'
            : isEnded
            ? 'VOUCH OS // ARCHIVED'
            : 'VOUCH OS // RFC 6238'}
        </span>
        <span>ID: {registration.id.slice(-8)}</span>
      </div>
    </div>
  );
}

