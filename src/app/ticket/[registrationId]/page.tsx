'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PassCard } from '@/components/ticket/PassCard';
import { Button, StatusChip } from '@/components/ui';
import { getFreshAuthToken } from '@/lib/firebase/client';
import { formatCurrency } from '@/lib/utils/format';
import type { EventItem, Registration } from '@/types';

interface PageParams {
  params: Promise<{ registrationId: string }>;
}

export default function TicketPage({ params }: PageParams) {
  const { registrationId } = use(params);
  const searchParams = useSearchParams();
  const eventIdFromQuery = searchParams.get('eventId');

  const [event, setEvent] = useState<EventItem | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Try local cached registration first
    const cached = localStorage.getItem(`vouch_ticket_${registrationId}`);
    if (cached) {
      try {
        const reg = JSON.parse(cached) as Registration;
        setRegistration(reg);

        // Fetch parent event details
        fetch(`/api/events/${reg.eventId || eventIdFromQuery}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.event) setEvent(data.event);
          })
          .catch((err) => console.error('Failed to load event details:', err))
          .finally(() => setLoading(false));
        return;
      } catch {
        // Fallback to fetch
      }
    }

    // 2. Otherwise fetch registration / event from API
    if (eventIdFromQuery) {
      fetch(`/api/events/${eventIdFromQuery}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.event) setEvent(data.event);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [registrationId, eventIdFromQuery]);

  const displayRegistration: Registration = registration || {
    id: registrationId,
    eventId: event?.id || 'demo_event',
    attendeeId: 'att_guest',
    attendeeName: 'Registered Guest',
    attendeeEmail: 'guest@vouch.event',
    qrToken: registrationId,
    totpSecret: 'JBSWY3DPEHPK3PXP', // Base32 fallback
    status: 'active',
    guestCount: 1,
    createdAt: new Date().toISOString(),
  };

  const displayEvent: EventItem = event || {
    id: eventIdFromQuery || 'demo_event',
    organizerId: 'org_admin',
    name: 'VOUCH Dynamic Access Pass',
    eventDate: new Date().toISOString(),
    capacity: 100,
    spotsRemaining: 50,
    createdAt: new Date().toISOString(),
  };

  const isEventEnded = event?.eventEndDate
    ? new Date(event.eventEndDate).getTime() <= Date.now()
    : false;

  const isCancelled = displayRegistration.status === 'cancelled';
  const seats = displayRegistration.guestCount || 1;
  const unitPrice = displayRegistration.ticketPrice !== undefined ? displayRegistration.ticketPrice : (event?.ticketPrice || 0);
  const totalAmount = unitPrice * seats;

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
      setCancelError(err.message || 'Error cancelling ticket.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
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
            isCancelled
              ? 'RESERVATION CANCELLED · REFUNDED'
              : (isEventEnded ? 'EVENT CONCLUDED · EXPIRED' : 'VERIFIED ENCRYPTED TOKEN')
          }
          variant={isCancelled || isEventEnded ? 'danger' : 'success'}
        />
      </header>

      {/* Main Pass Viewport */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 space-y-6">
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

          {!isCancelled && !isEventEnded && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCancelModal(true)}
              className="text-xs border-accent/60 text-accent hover:bg-accent hover:text-surface"
            >
              🚫 Cancel Reservation & Refund
            </Button>
          )}

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

