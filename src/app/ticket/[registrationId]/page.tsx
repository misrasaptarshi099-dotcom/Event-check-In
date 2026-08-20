'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PassCard } from '@/components/ticket/PassCard';
import { Button, StatusChip } from '@/components/ui';
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
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono bg-surface text-primary p-6">
        <div className="border border-border-rigid p-8 text-center text-xs animate-pulse">
          Retrieving dynamic cryptographic pass...
        </div>
      </div>
    );
  }

  // Fallback demo pass if opened directly without local storage
  const displayRegistration: Registration = registration || {
    id: registrationId,
    eventId: event?.id || 'demo_event',
    attendeeId: 'att_guest',
    attendeeName: 'Registered Guest',
    attendeeEmail: 'guest@vouch.event',
    qrToken: registrationId,
    totpSecret: 'JBSWY3DPEHPK3PXP', // Base32 fallback
    status: 'active',
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
        <StatusChip status="VERIFIED ENCRYPTED TOKEN" variant="success" />
      </header>

      {/* Main Pass Viewport */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 space-y-6">
        <PassCard event={displayEvent} registration={displayRegistration} />

        {/* Quick action bar */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            className="text-xs"
          >
            🖨️ Print Pass
          </Button>
          <Link href="/">
            <Button variant="outline" size="sm" className="text-xs">
              Return to Home
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
