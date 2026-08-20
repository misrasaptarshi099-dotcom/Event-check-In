'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input, StatusChip, ProgressBar } from '@/components/ui';
import type { EventItem } from '@/types';

interface PageParams {
  params: Promise<{ eventId: string }>;
}

export default function AttendeeRegistrationPage({ params }: PageParams) {
  const { eventId } = use(params);
  const router = useRouter();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    fetch(`/api/events/${eventId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.event) {
          setEvent(data.event);
        } else {
          setError(data.error || 'Event not found.');
        }
      })
      .catch((err) => setError(err.message || 'Failed to fetch event.'))
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendeeName: name.trim(),
          attendeeEmail: email.trim().toLowerCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      // Store registration data in localStorage for quick ticket access
      localStorage.setItem(`vouch_ticket_${data.registration.id}`, JSON.stringify(data.registration));

      router.push(`/ticket/${data.registration.id}?eventId=${eventId}`);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono bg-surface text-primary p-6">
        <div className="border border-border-rigid p-8 text-center text-xs animate-pulse">
          Connecting to live event registration ledger...
        </div>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-mono bg-surface text-primary p-6 space-y-4">
        <div className="border border-accent bg-accent/10 p-6 text-sm text-accent max-w-md text-center">
          [!] {error}
        </div>
        <Link href="/">
          <Button variant="secondary" size="md">Return to Home</Button>
        </Link>
      </div>
    );
  }

  const isSoldOut = event ? event.spotsRemaining <= 0 : false;
  const registeredCount = event ? event.capacity - event.spotsRemaining : 0;
  const fillPct = event ? Math.round((registeredCount / event.capacity) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col font-mono bg-surface text-primary">
      {/* Top Header */}
      <header className="border-b border-border-rigid px-6 md:px-12 flex items-center justify-between h-16 bg-surface">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-sm font-mono font-bold tracking-[0.25em] text-primary">
            VOUCH
          </span>
          <span className="text-[10px] font-mono text-muted-text">/</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-text">
            Attendee Registration
          </span>
        </Link>
        <StatusChip
          status={isSoldOut ? 'SOLD OUT' : 'SEATS AVAILABLE'}
          variant={isSoldOut ? 'danger' : 'success'}
        />
      </header>

      {/* Main Registration Showcase */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-xl border-2 border-border-rigid bg-surface shadow-2xl overflow-hidden">
          {/* Banner Hero if present */}
          {event?.bannerUrl && (
            <div className="h-44 w-full border-b border-border-rigid relative overflow-hidden bg-primary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.bannerUrl}
                alt={event.name}
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute top-3 right-3">
                {event.ticketPrice ? (
                  <span className="text-xs px-2.5 py-1 bg-primary text-surface font-bold">
                    ${event.ticketPrice} {event.currency || 'USD'}
                  </span>
                ) : (
                  <StatusChip status="FREE ADMISSION" variant="success" />
                )}
              </div>
            </div>
          )}

          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <p className="text-[10px] text-muted-text uppercase tracking-widest">
                {event?.eventDate ? new Date(event.eventDate).toLocaleDateString([], {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                }) : ''}
              </p>
              <h1 className="text-2xl sm:text-3xl font-serif italic text-primary font-medium tracking-tight mt-1">
                {event?.name}
              </h1>
              {event?.venue && (
                <p className="text-xs text-muted-text mt-1">📍 {event.venue}</p>
              )}
              {event?.description && (
                <p className="text-xs text-muted-text mt-3 leading-relaxed">
                  {event.description}
                </p>
              )}
            </div>

            {/* Capacity Status */}
            <div className="border border-border-rigid p-4 bg-surface-low space-y-2">
              <ProgressBar
                value={fillPct}
                label="Available Capacity"
                sublabel={`${event?.spotsRemaining} seats left of ${event?.capacity}`}
                variant={isSoldOut ? 'accent' : 'primary'}
                height="sm"
              />
            </div>

            {error && (
              <div className="border border-accent bg-accent/10 p-3 text-xs text-accent">
                [!] {error}
              </div>
            )}

            {/* Registration Form */}
            {isSoldOut ? (
              <div className="border border-accent bg-accent/5 p-6 text-center space-y-2">
                <h3 className="text-lg font-serif italic font-bold text-accent">
                  Capacity Reached
                </h3>
                <p className="text-xs text-muted-text">
                  This event is fully booked. Concurrency rules prevent overselling.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <Input
                  label="Your Full Name"
                  placeholder="e.g. Alex Vance"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />

                <Input
                  label="Your Email Address"
                  type="email"
                  placeholder="alex@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  hint="Your digital pass and TOTP key will be assigned to this email"
                  required
                />

                <Button
                  type="submit"
                  variant="accent"
                  size="lg"
                  loading={submitting}
                  className="w-full text-sm font-bold uppercase tracking-wider mt-2"
                >
                  {event?.ticketPrice ? `Reserve Seat · $${event.ticketPrice}` : 'Claim Free Pass'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
