'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, getFreshAuthToken } from '@/lib/firebase/client';
import { Button, Input, StatusChip, ProgressBar } from '@/components/ui';
import { formatCurrency } from '@/lib/utils/format';
import type { EventItem } from '@/types';

interface PageParams {
  params: Promise<{ eventId: string }>;
}

async function readApiJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  try {
    return body ? JSON.parse(body) as T : {} as T;
  } catch {
    throw new Error(
      response.ok
        ? 'The event service returned an invalid response. Please refresh and try again.'
        : `The event service is temporarily unavailable (${response.status}). Please try again shortly.`
    );
  }
}

export default function AttendeeRegistrationPage({ params }: PageParams) {
  const { eventId } = use(params);
  const router = useRouter();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [name, setName] = useState('');
  const [guestCount, setGuestCount] = useState(1);

  // 1. Fetch Event metadata
  useEffect(() => {
    fetch(`/api/events/${eventId}`)
      .then(async (res) => {
        const data = await readApiJson<{ event?: EventItem; error?: string }>(res);
        if (!res.ok) throw new Error(data.error || `Unable to load this event (${res.status}).`);
        return data;
      })
      .then((data) => {
        if (data.event) setEvent(data.event);
        else setError(data.error || 'Event not found.');
      })
      .catch((err) => setError(err.message || 'Failed to fetch event.'))
      .finally(() => setLoading(false));
  }, [eventId]);

  // 2. Track authenticated user
  useEffect(() => {
    const cachedEmail = localStorage.getItem('vouch_user_email');
    const cachedName = localStorage.getItem('vouch_user_name');
    if (cachedEmail) {
      setUserEmail(cachedEmail);
      setName(cachedName || '');
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email) {
        setUserEmail(user.email);
        setUserName(user.displayName || '');
        setName((prev) => prev || user.displayName || '');
        localStorage.setItem('vouch_user_email', user.email);
        localStorage.setItem('vouch_user_name', user.displayName || '');
        localStorage.setItem('vouch_user_uid', user.uid);
      } else {
        setUserEmail(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const email = user.email || '';

      localStorage.setItem('vouch_user_uid', user.uid);
      localStorage.setItem('vouch_user_email', email);
      localStorage.setItem('vouch_user_name', user.displayName || '');

      setUserEmail(email);
      setName(user.displayName || '');
    } catch (err: any) {
      setError(err.message || 'Google authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !userEmail) return;

    setSubmitting(true);
    setError(null);

    try {
      const token = await getFreshAuthToken();
      if (!token) {
        throw new Error('Please sign in with Google to complete registration.');
      }

      const res = await fetch(`/api/events/${eventId}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          attendeeName: name.trim() || userName || 'Guest Attendee',
          attendeeEmail: userEmail.trim().toLowerCase(),
          guestCount,
        }),
      });

      const data = await readApiJson<{ registration?: { id: string }; error?: string }>(res);

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }
      if (!data.registration) {
        throw new Error('Registration completed without a pass. Please try again.');
      }

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
      <div className="min-h-screen flex flex-col items-center justify-center font-mono bg-surface text-primary p-6 space-y-4 animate-in fade-in duration-200">
        <div className="w-8 h-8 border-2 border-primary animate-spin" />
        <div className="border border-border-rigid p-6 text-center space-y-1 bg-surface-low shadow-sm max-w-sm w-full">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">LOADING REGISTRATION</p>
          <p className="text-[10px] text-muted-text">Connecting to live event registration ledger...</p>
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

  const isEventCancelled = event?.status === 'cancelled';
  const isSoldOut = event ? event.spotsRemaining <= 0 : false;
  const isStarted = event ? new Date(event.eventDate).getTime() <= Date.now() : false;
  const isEnded = event?.eventEndDate ? new Date(event.eventEndDate).getTime() <= Date.now() : false;
  const isRegistrationClosed = isEventCancelled || isStarted || isEnded;

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
          status={
            isEventCancelled
              ? 'EVENT CANCELLED'
              : isRegistrationClosed
              ? 'REGISTRATION CLOSED'
              : isSoldOut
              ? 'SOLD OUT'
              : 'SEATS AVAILABLE'
          }
          variant={isEventCancelled || isRegistrationClosed || isSoldOut ? 'danger' : 'success'}
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
                variant={isRegistrationClosed || isSoldOut ? 'accent' : 'primary'}
                height="sm"
              />
            </div>

            {error && (
              <div className="border border-accent bg-accent/10 p-3 text-xs text-accent">
                [!] {error}
              </div>
            )}

            {/* CASE 0: Event Cancelled by Host */}
            {isEventCancelled ? (
              <div className="border-2 border-accent bg-accent/5 p-6 text-center space-y-4">
                <StatusChip status="EVENT CANCELLED" variant="danger" />
                <h3 className="text-xl font-serif italic font-bold text-accent">
                  This Event Has Been Cancelled
                </h3>
                <div className="p-4 bg-surface border border-accent/40 text-xs font-serif italic text-primary leading-relaxed max-w-md mx-auto">
                  &ldquo;{event?.cancellationReason || 'We sincerely apologize for the inconvenience. This event was cancelled by the host.'}&rdquo;
                </div>
                <p className="text-xs text-muted-text max-w-md mx-auto">
                  All attendee passes have been cancelled and refunded in full. No new registrations are accepted.
                </p>
                <Link href="/" className="inline-block pt-2">
                  <Button variant="secondary" size="sm">
                    ← Return to Discover Events
                  </Button>
                </Link>
              </div>
            ) : isRegistrationClosed ? (
              /* CASE 1: Event Started or Ended — Closed */
              <div className="border-2 border-accent bg-accent/5 p-6 text-center space-y-3">
                <StatusChip status="REGISTRATION CLOSED" variant="danger" />
                <h3 className="text-xl font-serif italic font-bold text-accent">
                  {isEnded ? 'Event Concluded' : 'Event Has Already Started'}
                </h3>
                <p className="text-xs text-muted-text max-w-md mx-auto">
                  Registrations close automatically once an event begins. No new passes can be issued for this session.
                </p>
                <Link href="/" className="inline-block pt-2">
                  <Button variant="secondary" size="sm">
                    ← Return to Upcoming Events
                  </Button>
                </Link>
              </div>
            ) : isSoldOut ? (
              /* CASE 2: Sold out */
              <div className="border border-accent bg-accent/5 p-6 text-center space-y-2">
                <h3 className="text-lg font-serif italic font-bold text-accent">
                  Capacity Reached
                </h3>
                <p className="text-xs text-muted-text">
                  This event is fully booked. Concurrency rules prevent overselling.
                </p>
              </div>
            ) : !userEmail ? (
              /* CASE 3: Not logged in — Enforce Auth Gate */
              <div className="border-2 border-border-rigid p-6 bg-surface-low text-center space-y-4">
                <div className="space-y-1">
                  <span className="text-2xl">🔒</span>
                  <h3 className="text-base font-serif italic font-bold text-primary">
                    Authentication Required
                  </h3>
                  <p className="text-xs text-muted-text">
                    You must sign in with Google to register for this event. Your verified email will be permanently bound to your dynamic gate QR pass.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={authLoading}
                  className="w-full h-12 border-2 border-border-rigid bg-surface hover:bg-surface-high transition-colors flex items-center justify-center gap-3 font-mono text-xs uppercase font-bold tracking-wider text-primary shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>{authLoading ? 'Signing in...' : 'Continue with Google to Register'}</span>
                </button>
              </div>
            ) : (
              /* CASE 4: Logged in & Open — Registration Form */
              <form onSubmit={handleRegister} className="space-y-4">
                {/* Authenticated Identity Locked Display */}
                <div className="border border-border-rigid p-3.5 bg-surface-high space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-muted-text tracking-wider">
                      Verified Identity (Locked)
                    </span>
                    <span className="text-[10px] text-[#15803D] font-bold">✓ Signed In</span>
                  </div>
                  <p className="text-xs font-mono font-semibold text-primary">{userEmail}</p>
                  <p className="text-[10px] text-muted-text">
                    Pass will be bound strictly to this Google account.
                  </p>
                </div>

                <Input
                  label="Your Full Name"
                  placeholder="e.g. Alex Vance"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />

                {/* Guest Count Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-muted-text font-medium block">
                    Number of Guests (Including You)
                  </label>
                  <div className="flex items-center gap-3 border-b border-border-rigid pb-3">
                    <button
                      type="button"
                      onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                      disabled={guestCount <= 1}
                      className="w-10 h-10 border border-border-rigid bg-surface-high flex items-center justify-center text-lg font-bold text-primary hover:bg-primary hover:text-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      −
                    </button>
                    <div className="flex-1 text-center">
                      <span className="text-2xl font-bold text-primary">{guestCount}</span>
                      <span className="text-[10px] text-muted-text block uppercase tracking-wider">
                        {guestCount === 1 ? 'Just You' : `You + ${guestCount - 1} Guest${guestCount > 2 ? 's' : ''}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGuestCount(Math.min(5, guestCount + 1))}
                      disabled={guestCount >= 5 || (event ? guestCount >= event.spotsRemaining : false)}
                      className="w-10 h-10 border border-border-rigid bg-surface-high flex items-center justify-center text-lg font-bold text-primary hover:bg-primary hover:text-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-text">
                    Max 5 per registration · {event?.spotsRemaining} seat{event?.spotsRemaining !== 1 ? 's' : ''} available
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="accent"
                  size="lg"
                  loading={submitting}
                  className="w-full text-sm font-bold uppercase tracking-wider mt-2"
                >
                  {event?.ticketPrice
                    ? `Reserve ${guestCount} Seat${guestCount > 1 ? 's' : ''} · ${formatCurrency(event.ticketPrice * guestCount, event.currency)}`
                    : `Claim ${guestCount} Free Pass${guestCount > 1 ? 'es' : ''}`}
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
