'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, getFreshAuthToken } from '@/lib/firebase/client';
import { Button, StatusChip } from '@/components/ui';
import type { EventItem, Registration } from '@/types';

type EnrichedRegistration = Registration & { event?: EventItem };

export default function HomePage() {
  const [role, setRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<EnrichedRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [passesLoading, setPassesLoading] = useState(false);

  const fetchPasses = async (email: string) => {
    if (!email) return;
    setPassesLoading(true);
    try {
      const token = await getFreshAuthToken();
      const res = await fetch(`/api/attendee/registrations?email=${encodeURIComponent(email)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.registrations) {
        setMyRegistrations(data.registrations);
      }
    } catch (err) {
      console.error('Failed to fetch attendee passes:', err);
    } finally {
      setPassesLoading(false);
    }
  };

  const fetchPublicEvents = () => {
    setLoading(true);
    fetch('/api/events')
      .then((res) => res.json())
      .then((data) => {
        if (data.events) {
          setEvents(data.events);
        } else if (data.error) {
          console.error('API Error:', data.error);
        }
      })
      .catch((err) => console.error('Failed to load events:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const savedRole = localStorage.getItem('vouch_user_role');
    const savedEmail = localStorage.getItem('vouch_user_email');

    setRole(savedRole);
    setUserEmail(savedEmail);

    fetchPublicEvents();

    if (savedEmail) {
      fetchPasses(savedEmail);
    }

    // Listen to Firebase Auth state to keep token fresh
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        setUserEmail(user.email);
        localStorage.setItem('vouch_user_email', user.email);
        localStorage.setItem('vouch_user_uid', user.uid);
        const token = await user.getIdToken();
        localStorage.setItem('vouch_auth_token', token);
        fetchPasses(user.email);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {}
    localStorage.removeItem('vouch_user_role');
    localStorage.removeItem('vouch_user_uid');
    localStorage.removeItem('vouch_user_email');
    localStorage.removeItem('vouch_user_name');
    localStorage.removeItem('vouch_auth_token');
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col font-mono bg-surface text-primary">
      {/* Top rigid border */}
      <div className="border-b border-border-rigid" />

      {/* Header */}
      <header className="border-b border-border-rigid px-6 md:px-12 flex items-center justify-between h-16 bg-surface">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono font-bold tracking-[0.25em] text-primary">
            VOUCH
          </span>
          <span className="text-[10px] font-mono text-muted-text">/</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-text">
            Event Check-In OS
          </span>
        </div>
        <div className="flex items-center gap-3">
          {myRegistrations.length > 0 && (
            <a href="#my-passes">
              <Button variant="accent" size="sm" className="text-xs">
                🎟️ My Passes ({myRegistrations.length})
              </Button>
            </a>
          )}
          {role === 'organizer' && (
            <>
              <Link href="/scanner">
                <Button variant="outline" size="sm">
                  📷 Fast Gate Scanner
                </Button>
              </Link>
              <Link href="/organizer">
                <Button variant="secondary" size="sm">
                  Organizer Portal
                </Button>
              </Link>
            </>
          )}
          {role && userEmail && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 border border-border-rigid bg-surface-high text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="font-semibold uppercase">{role}:</span>
              <span className="text-muted-text truncate max-w-[160px]">{userEmail}</span>
            </div>
          )}
          {role ? (
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          ) : (
            <Link href="/auth/login">
              <Button variant="primary" size="sm">
                Login / Sign In
              </Button>
            </Link>
          )}
        </div>
      </header>

      {/* Main Content Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 md:px-12 py-12">
        <div className="max-w-4xl w-full space-y-12 text-center">
          {/* Hero Title */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-border-rigid bg-surface-high text-[10px] uppercase tracking-widest text-primary">
              <span className="w-2 h-2 rounded-full bg-[#15803D] animate-pulse" />
              Real-Time Concurrency Architecture
            </div>
            <h1 className="text-5xl md:text-7xl font-serif italic leading-[1.05] tracking-tight text-primary">
              Every Scan,<br />
              <span className="text-accent">Exactly Once.</span>
            </h1>
            <p className="text-sm font-mono text-muted-text leading-relaxed max-w-lg mx-auto mt-4">
              Concurrency-safe event operations with rotating TOTP dynamic QR passes,
              financial intelligence, and zero-drop offline scanning.
            </p>
          </div>

          {/* CTA Row */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {role === 'organizer' ? (
              <>
                <Link href="/organizer" className="w-full sm:w-auto">
                  <Button variant="accent" size="lg" className="w-full sm:w-auto min-w-[200px]">
                    Organizer Workspace
                  </Button>
                </Link>
                <Link href="/organizer/create" className="w-full sm:w-auto">
                  <Button variant="primary" size="lg" className="w-full sm:w-auto min-w-[200px]">
                    Create New Event
                  </Button>
                </Link>
              </>
            ) : myRegistrations.length > 0 ? (
              <>
                <a href="#my-passes" className="w-full sm:w-auto">
                  <Button variant="accent" size="lg" className="w-full sm:w-auto min-w-[200px]">
                    🎟️ View My Passes ({myRegistrations.length})
                  </Button>
                </a>
                <a href="#events-ledger" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto min-w-[200px]">
                    Browse All Events
                  </Button>
                </a>
              </>
            ) : role === 'attendee' ? (
              <a href="#events-ledger" className="w-full sm:w-auto">
                <Button variant="accent" size="lg" className="w-full sm:w-auto min-w-[200px]">
                  Browse Public Events
                </Button>
              </a>
            ) : (
              <>
                <Link href="/auth/login" className="w-full sm:w-auto">
                  <Button variant="accent" size="lg" className="w-full sm:w-auto min-w-[200px]">
                    Sign In / Register
                  </Button>
                </Link>
                <a href="#events-ledger" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto min-w-[200px]">
                    Browse Events
                  </Button>
                </a>
              </>
            )}
          </div>

          {/* 1. MY PASSES & REGISTERED EVENTS SECTION (If attendee has registrations) */}
          {userEmail && (
            <div id="my-passes" className="text-left space-y-4 pt-6 border-t border-border-rigid">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🎟️</span>
                    <h3 className="text-xs uppercase tracking-widest font-bold text-primary">
                      My Registered Events & Dynamic Passes
                    </h3>
                  </div>
                  <p className="text-[10px] text-muted-text mt-0.5">
                    Click any pass to access your live rotating cryptographic QR gate token
                  </p>
                </div>
                <span className="text-[10px] bg-primary text-surface px-2 py-0.5 font-bold uppercase tracking-wider">
                  {myRegistrations.length} Active {myRegistrations.length === 1 ? 'Pass' : 'Passes'}
                </span>
              </div>

              {passesLoading ? (
                <div className="p-8 text-center border border-border-rigid text-xs text-muted-text animate-pulse bg-surface-low">
                  Retrieving your digital access ledger...
                </div>
              ) : myRegistrations.length === 0 ? (
                <div className="border border-border-rigid p-6 text-center space-y-2 bg-surface-low">
                  <p className="text-xs text-muted-text">
                    You have not registered for any events yet under <span className="font-semibold text-primary">{userEmail}</span>.
                  </p>
                  <a href="#events-ledger" className="inline-block pt-1">
                    <Button variant="outline" size="sm">
                      Browse Open Events Below
                    </Button>
                  </a>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myRegistrations.map((reg) => {
                    const eventTitle = reg.event?.name || 'Event Pass';
                    const eventDate = reg.event?.eventDate;
                    const eventVenue = reg.event?.venue;
                    const isEventCancelled = reg.event?.status === 'cancelled';
                    const isCancelled = reg.status === 'cancelled' || isEventCancelled;
                    const isEventEnded = reg.event?.eventEndDate
                      ? new Date(reg.event.eventEndDate).getTime() <= Date.now()
                      : (reg.event?.eventDate ? new Date(reg.event.eventDate).getTime() <= Date.now() : false);

                    const seats = reg.guestCount ?? 1;
                    const unitPrice = reg.ticketPrice !== undefined ? reg.ticketPrice : (reg.event?.ticketPrice || 0);
                    const totalCost = unitPrice * seats;

                    return (
                      <div
                        key={reg.id}
                        className={`border-2 border-border-rigid p-5 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group ${
                          isCancelled ? 'bg-surface-low border-dashed border-accent/40 opacity-90' : (isEventEnded ? 'bg-surface-low opacity-85' : 'bg-surface')
                        }`}
                      >
                        {/* Status bar */}
                        <div className="flex items-center justify-between border-b border-border-rigid pb-2.5">
                          <div className="flex items-center gap-1.5">
                            {isEventCancelled ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-accent" />
                                <span className="text-[10px] uppercase font-bold text-accent tracking-widest">
                                  EVENT CANCELLED · REFUNDED
                                </span>
                              </>
                            ) : isCancelled ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-accent" />
                                <span className="text-[10px] uppercase font-bold text-accent tracking-widest">
                                  CANCELLED · REFUNDED
                                </span>
                              </>
                            ) : reg.checkedIn ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-[#15803D]" />
                                <span className="text-[10px] uppercase font-bold text-[#15803D] tracking-widest">
                                  ADMITTED · CHECKED IN
                                </span>
                              </>
                            ) : isEventEnded ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-muted-text" />
                                <span className="text-[10px] uppercase font-bold text-muted-text tracking-widest">
                                  EXPIRED PASS
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="w-2 h-2 rounded-full bg-[#15803D] animate-ping" />
                                <span className="text-[10px] uppercase font-bold text-primary tracking-widest">
                                  ACTIVE PASS
                                </span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] bg-surface-high border border-border-rigid px-2 py-0.5 font-bold text-primary">
                              {seats} {seats > 1 ? 'SEATS' : 'SEAT'}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 border font-bold ${
                              isCancelled ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border-rigid bg-surface text-muted-text'
                            }`}>
                              {isCancelled ? 'REFUNDED' : (totalCost > 0 ? 'PAID' : 'FREE')}
                            </span>
                          </div>
                        </div>

                        {/* Event Details */}
                        <div className="space-y-1">
                          <h4 className={`text-xl font-serif italic font-medium tracking-tight ${isCancelled ? 'text-muted-text line-through' : 'text-primary'}`}>
                            {eventTitle}
                          </h4>
                          {eventDate && (
                            <p className="text-[11px] text-muted-text">
                              📅 {new Date(eventDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · {new Date(eventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                          {eventVenue && (
                            <p className="text-[11px] text-muted-text">📍 {eventVenue}</p>
                          )}
                          <div className="flex items-center justify-between text-[10px] text-muted-text font-mono pt-1">
                            <span>Pass: <span className="text-primary">{reg.attendeeName}</span></span>
                            <span>{totalCost > 0 ? (isCancelled ? `₹${totalCost.toLocaleString()} Refunded` : `₹${totalCost.toLocaleString()} Paid`) : 'Complimentary'}</span>
                          </div>
                        </div>

                        {/* CTA button */}
                        <div className="pt-2 border-t border-border-rigid">
                          {isCancelled ? (
                            <Link href={`/ticket/${reg.id}?eventId=${reg.eventId}`} className="block w-full">
                              <Button
                                variant="outline"
                                size="md"
                                className="w-full text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-accent/40 text-accent hover:bg-accent/10"
                              >
                                <span>🚫 View Refunded Receipt</span>
                                <span>→</span>
                              </Button>
                            </Link>
                          ) : reg.checkedIn ? (
                            <Link href={`/ticket/${reg.id}?eventId=${reg.eventId}`} className="block w-full">
                              <Button
                                variant="outline"
                                size="md"
                                className="w-full text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-primary bg-surface-low text-primary hover:bg-surface-high"
                              >
                                <span>✅ Pass Admitted at Gate</span>
                                <span>→</span>
                              </Button>
                            </Link>
                          ) : isEventEnded ? (
                            <div className="w-full py-2.5 px-3 bg-surface-container border border-border-rigid text-center text-xs font-bold uppercase tracking-wider text-muted-text flex items-center justify-center gap-2 select-none">
                              <span>🔒 Event Concluded · Pass Expired</span>
                            </div>
                          ) : (
                            <Link href={`/ticket/${reg.id}?eventId=${reg.eventId}`} className="block w-full">
                              <Button
                                variant="accent"
                                size="md"
                                className="w-full text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                              >
                                <span>🎟️ Open Dynamic QR Pass</span>
                                <span>→</span>
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. Active Public Events Ledger */}
          <div id="events-ledger" className="text-left space-y-3 pt-6 border-t border-border-rigid">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-widest font-bold text-muted-text">
                Active Events Ledger
              </h3>
              <span className="text-[10px] text-muted-text">
                {events.length} Available for Registration
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center border border-border-rigid text-xs text-muted-text animate-pulse">
                Loading events ledger...
              </div>
            ) : events.length === 0 ? (
              <div className="border border-border-rigid p-8 text-center space-y-2 bg-surface-low">
                <p className="font-serif italic text-sm text-primary">No events published yet.</p>
                {role === 'organizer' ? (
                  <Link href="/organizer/create" className="inline-block pt-2">
                    <Button variant="secondary" size="sm">
                      + Create Your First Event
                    </Button>
                  </Link>
                ) : (
                  <p className="text-[11px] text-muted-text">
                    Please check back soon for open registrations and admission passes.
                  </p>
                )}
              </div>
            ) : (
              <div className="border border-border-rigid divide-y divide-border-rigid">
                {events.map((event) => {
                  const userReg = myRegistrations.find((r) => r.eventId === event.id);
                  const isEventCancelled = event.status === 'cancelled';
                  const isStarted = new Date(event.eventDate).getTime() <= Date.now();
                  const isEnded = event.eventEndDate ? new Date(event.eventEndDate).getTime() <= Date.now() : false;
                  const isClosed = isEventCancelled || isStarted || isEnded;

                  return (
                    <div
                      key={event.id}
                      className="grid-ledger-row p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`font-serif italic text-lg font-medium ${isEventCancelled ? 'text-muted-text line-through' : 'text-primary'}`}>
                            {event.name}
                          </span>
                          {event.ticketPrice ? (
                            <span className="text-[10px] px-1.5 py-0.5 border border-border-rigid bg-surface-high font-bold">
                              ${event.ticketPrice} {event.currency || 'USD'}
                            </span>
                          ) : (
                            <StatusChip status="FREE ADMISSION" variant="success" />
                          )}
                          {userReg && (
                            <StatusChip
                              status={
                                isEventCancelled || userReg.status === 'cancelled'
                                  ? 'CANCELLED'
                                  : userReg.checkedIn
                                  ? 'ADMITTED'
                                  : 'REGISTERED'
                              }
                              variant={isEventCancelled || userReg.status === 'cancelled' ? 'danger' : 'success'}
                            />
                          )}
                          {isClosed && (
                            <StatusChip
                              status={
                                isEventCancelled
                                  ? 'EVENT CANCELLED'
                                  : isEnded
                                  ? 'CONCLUDED'
                                  : 'LIVE NOW · REGISTRATION CLOSED'
                              }
                              variant="danger"
                            />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-text muted-label">
                          {new Date(event.eventDate).toLocaleDateString([], {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          · {event.spotsRemaining} spots remaining of {event.capacity}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {userReg ? (
                          <Link href={`/ticket/${userReg.id}?eventId=${event.id}`}>
                            <Button
                              variant={userReg.checkedIn ? 'outline' : 'accent'}
                              size="sm"
                              className={
                                userReg.checkedIn
                                  ? 'border-primary bg-surface-low text-primary text-[11px] font-bold'
                                  : 'bg-[#15803D] hover:bg-[#166534] border-[#15803D] text-[11px] font-bold'
                              }
                            >
                              {userReg.status === 'cancelled'
                                ? '🚫 View Receipt'
                                : userReg.checkedIn
                                ? '✅ View Admitted Pass'
                                : '🎟️ View QR Pass'}
                            </Button>
                          </Link>
                        ) : isClosed ? (
                          <Button variant="outline" size="sm" disabled className="opacity-50 cursor-not-allowed text-[10px]">
                            Registration Closed
                          </Button>
                        ) : (
                          <Link href={`/register/${event.id}`}>
                            <Button variant="accent" size="sm">
                              Register
                            </Button>
                          </Link>
                        )}
                        {role === 'organizer' && (
                          <Link href={`/organizer/events/${event.id}`}>
                            <Button variant="outline" size="sm">
                              Dashboard
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-rigid px-6 md:px-12 py-4 flex items-center justify-between bg-surface">
        <span className="text-[10px] font-mono text-muted-text uppercase tracking-wider">
          VOUCH Infrastructure · v1.0
        </span>
        <span className="text-[10px] font-mono text-muted-text">
          {new Date().getFullYear()}
        </span>
      </footer>
    </div>
  );
}
