'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { PassCard } from '@/components/ticket/PassCard';
import { Button, StatusChip } from '@/components/ui';
import { getFreshAuthToken } from '@/lib/firebase/client';
import { clientCache } from '@/lib/cache/clientCache';
import { formatCurrency } from '@/lib/utils/format';
import type { EventItem, Registration } from '@/types';

interface PageParams {
  params: Promise<{ registrationId: string }>;
}

export default function TicketPage({ params }: PageParams) {
  const { registrationId } = use(params);

  // Initialize synchronously from client cache to achieve 0ms frame-1 instant render
  const initialCached = typeof window !== 'undefined' ? clientCache.getPassBundle(registrationId) : null;

  const [event, setEvent] = useState<EventItem | null>(initialCached?.event || null);
  const [registration, setRegistration] = useState<Registration | null>(initialCached?.registration || null);
  const [loading, setLoading] = useState(!initialCached);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTicket() {
      try {
        const token = await getFreshAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/registrations/${registrationId}`, { headers });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Unable to retrieve ticket pass.');
        }

        if (isMounted) {
          if (data.registration) setRegistration(data.registration);
          if (data.event) setEvent(data.event);

          if (data.registration && data.event) {
            clientCache.setPassBundle(registrationId, {
              registration: data.registration,
              event: data.event,
            });
          }
        }
      } catch (err: any) {
        if (isMounted && !registration) {
          setFetchError(err.message || 'Ticket not found or access denied.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadTicket();

    return () => {
      isMounted = false;
    };
  }, [registrationId]);

  if (fetchError && !registration) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-mono bg-surface text-primary p-6 space-y-4">
        <div className="border border-accent bg-accent/10 p-6 text-sm text-accent max-w-md text-center space-y-2">
          <p className="font-bold uppercase tracking-wider">[!] Security Notice</p>
          <p className="text-xs text-primary">{fetchError}</p>
        </div>
        <Link href="/">
          <Button variant="secondary" size="md">Return to My Passes</Button>
        </Link>
      </div>
    );
  }

  if (loading && (!registration || !event)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-mono bg-surface text-primary p-6 space-y-4 animate-in fade-in duration-150">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin" />
        <div className="border border-border-rigid p-6 text-center space-y-1 bg-surface-low shadow-sm max-w-sm w-full">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">RETRIEVING PASS</p>
          <p className="text-[10px] text-muted-text">Verifying cryptographic admission credentials...</p>
        </div>
      </div>
    );
  }

  // Authoritative real data is guaranteed loaded here (no dummy placeholder flash)
  const displayRegistration = registration!;
  const displayEvent = event!;

  const isEventEnded = displayEvent.eventEndDate
    ? new Date(displayEvent.eventEndDate).getTime() <= Date.now()
    : false;

  const isEventCancelled = displayEvent.status === 'cancelled';
  const isCheckedIn = displayRegistration.checkedIn === true;
  const isCancelled = displayRegistration.status === 'cancelled' || isEventCancelled;
  const seats = displayRegistration.guestCount || 1;
  const unitPrice = displayRegistration.ticketPrice !== undefined ? displayRegistration.ticketPrice : (displayEvent.ticketPrice || 0);
  const totalAmount = unitPrice * seats;

  // 30-Minute cancellation cutoff policy
  const eventStartMs = new Date(displayEvent.eventDate).getTime();
  const cancellationDeadlineMs = eventStartMs - (30 * 60 * 1000);
  const isCancellationWindowClosed = Date.now() >= cancellationDeadlineMs;
  const canCancel = !isCheckedIn && !isCancelled && !isCancellationWindowClosed && !isEventEnded;

  const handleCancelTicket = async () => {
    setCancelling(true);
    setCancelError(null);

    try {
      const token = await getFreshAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/registrations/${displayRegistration.id}/cancel`, {
        method: 'POST',
        headers,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel reservation.');
      }

      const updatedReg: Registration = {
        ...displayRegistration,
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
      };
      setRegistration(updatedReg);
      localStorage.setItem(`vouch_ticket_${registrationId}`, JSON.stringify(updatedReg));
      setShowCancelModal(false);
    } catch (err: any) {
      setCancelError(err.message || 'Cancellation failed. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading && !registration) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-mono bg-surface text-primary p-6 space-y-4 animate-in fade-in duration-200">
        <div className="w-8 h-8 border-2 border-primary animate-spin" />
        <div className="border border-border-rigid p-6 text-center space-y-1 bg-surface-low shadow-sm max-w-sm w-full">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">RETRIEVING PASS</p>
          <p className="text-[10px] text-muted-text">Decrypting dynamic cryptographic ticket credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-mono bg-surface-low text-primary">
      {/* Top Header */}
      <header className="border-b border-border-rigid px-6 md:px-12 flex items-center justify-between h-16 bg-surface">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-sm font-mono font-bold tracking-[0.25em] text-primary">
            VOUCH
          </span>
          <span className="text-[10px] font-mono text-muted-text">/</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-text">
            Digital Admission Pass
          </span>
        </Link>
        <StatusChip
          status={
            isEventCancelled
              ? 'EVENT CANCELLED BY HOST · FULL REFUND'
              : isCancelled
              ? 'RESERVATION CANCELLED · REFUNDED'
              : isCheckedIn
              ? 'ADMITTED AT GATE'
              : isEventEnded
              ? 'EVENT CONCLUDED · EXPIRED'
              : 'VERIFIED ENCRYPTED TOKEN'
          }
          variant={isCancelled || isEventEnded ? 'danger' : 'success'}
        />
      </header>

      {/* Main Pass Viewport */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 space-y-6">
        {/* Host Cancellation Apology Alert */}
        {isEventCancelled && (
          <div className="w-full max-w-md bg-accent/10 border-2 border-accent p-5 space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-wider">
              <span>⚠️</span>
              <span>Important Message from Event Organizer</span>
            </div>
            <h3 className="text-base font-serif italic font-bold text-primary">
              &ldquo;{displayEvent.name}&rdquo; has been cancelled
            </h3>
            <div className="p-3 bg-surface border border-accent/40 text-xs font-serif italic text-primary leading-relaxed">
              &ldquo;{displayEvent.cancellationReason || 'We sincerely apologize for the inconvenience. The event has been cancelled and full refunds have been processed.'}&rdquo;
            </div>
            <div className="pt-1 text-[10px] text-muted-text font-mono flex justify-between border-t border-accent/20">
              <span>Refund Outflow: <strong className="text-accent">{totalAmount > 0 ? formatCurrency(totalAmount, displayEvent.currency) : 'Free Admission'}</strong></span>
              <span>Ledger Status: <strong className="text-accent">AUTOMATICALLY REFUNDED</strong></span>
            </div>
          </div>
        )}

        <PassCard event={displayEvent} registration={displayRegistration} />

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            className="text-xs"
          >
            🖨️ Print Pass
          </Button>

          {/* Cancellation Control: Only permitted if not admitted, not cancelled, and >= 30m prior to start */}
          {isEventCancelled ? (
            <div className="flex items-center gap-1.5 px-3 py-2 border border-accent/40 bg-accent/10 text-xs font-semibold text-accent">
              <span>🚫</span> Event Cancelled by Host · Refund Issued
            </div>
          ) : isCheckedIn ? (
            <div className="flex items-center gap-1.5 px-3 py-2 border border-border-rigid bg-surface text-xs font-semibold text-primary">
              <span>✓</span> Ticket Admitted at Gate
            </div>
          ) : isCancelled ? (
            <div className="flex items-center gap-1.5 px-3 py-2 border border-accent/40 bg-accent/10 text-xs font-semibold text-accent">
              <span>🚫</span> Reservation Cancelled
            </div>
          ) : isEventEnded ? (
            <div className="flex items-center gap-1.5 px-3 py-2 border border-border-rigid/40 bg-surface-high text-xs text-muted-text">
              <span>🎟️</span> Event Concluded
            </div>
          ) : isCancellationWindowClosed ? (
            <div
              className="flex items-center gap-1.5 px-3 py-2 border border-border-rigid/40 bg-surface-high text-xs text-muted-text"
              title="Cancellation closes 30 minutes before event start"
            >
              <span>⏳</span> Cancellation Closed (Past 30m Cutoff)
            </div>
          ) : canCancel ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCancelModal(true)}
              className="text-xs border-accent/60 text-accent hover:bg-accent hover:text-surface"
            >
              🚫 Cancel Reservation & Refund
            </Button>
          ) : null}

          <Link href="/">
            <Button variant="outline" size="sm" className="text-xs">
              Return to Home
            </Button>
          </Link>
        </div>
      </main>

      {/* Cancellation Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 font-mono">
          <div className="bg-surface border-2 border-border-rigid w-full max-w-md shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2 border-b border-border-rigid pb-4">
              <div className="flex items-center gap-2 text-accent text-sm font-bold uppercase tracking-wider">
                <span>🚫</span>
                <h4>Confirm Ticket Cancellation</h4>
              </div>
              <p className="text-xs text-muted-text">
                Are you sure you want to cancel your reservation for{' '}
                <span className="font-bold text-primary">{displayEvent.name}</span>?
              </p>
            </div>

            <div className="p-4 bg-surface-low border border-border-rigid space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-text">Reserved Seats:</span>
                <span className="font-bold text-primary">{seats} seat(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-text">Refund Value:</span>
                <span className="font-bold text-accent">
                  {totalAmount > 0 ? formatCurrency(totalAmount, displayEvent.currency) : 'Free Admission'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-text">Action:</span>
                <span className="text-muted-text font-medium">Seats returned to capacity & QR pass voided</span>
              </div>
            </div>

            {cancelError && (
              <div className="border border-accent bg-accent/10 p-3 text-xs text-accent">
                [!] {cancelError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="accent"
                size="md"
                loading={cancelling}
                disabled={cancelling}
                onClick={handleCancelTicket}
                className="flex-1"
              >
                Confirm Cancellation
              </Button>
              <Button
                variant="outline"
                size="md"
                disabled={cancelling}
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelError(null);
                }}
                className="flex-1"
              >
                Keep My Pass
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

