'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, StatusChip } from '@/components/ui';
import type { EventItem } from '@/types';

export default function HomePage() {
  const [role, setRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRole(localStorage.getItem('vouch_user_role'));
    setUserEmail(localStorage.getItem('vouch_user_email'));

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
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('vouch_user_role');
    localStorage.removeItem('vouch_user_uid');
    localStorage.removeItem('vouch_user_email');
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
      <main className="flex-1 flex flex-col items-center justify-center px-6 md:px-12 py-16">
        <div className="max-w-3xl w-full space-y-12 text-center">
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

          {/* Active Public Events Ledger */}
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
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="grid-ledger-row p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-serif italic text-lg font-medium text-primary">
                          {event.name}
                        </span>
                        {event.ticketPrice ? (
                          <span className="text-[10px] px-1.5 py-0.5 border border-border-rigid bg-surface-high font-bold">
                            ${event.ticketPrice} {event.currency || 'USD'}
                          </span>
                        ) : (
                          <StatusChip status="FREE ADMISSION" variant="success" />
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
                      <Link href={`/register/${event.id}`}>
                        <Button variant="accent" size="sm">
                          Register
                        </Button>
                      </Link>
                      {role === 'organizer' && (
                        <Link href={`/organizer/events/${event.id}`}>
                          <Button variant="outline" size="sm">
                            Dashboard
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
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
