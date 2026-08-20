'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, StatusChip, ProgressBar } from '@/components/ui';
import type { EventItem } from '@/types';

export default function OrganizerDashboard() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const role = localStorage.getItem('vouch_user_role');
    const token = localStorage.getItem('vouch_auth_token');

    if (!token || role !== 'organizer') {
      window.location.href = '/auth/login';
      return;
    }

    fetch('/api/events', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
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
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex flex-col font-mono bg-surface text-primary">
      {/* Navigation Header */}
      <header className="border-b border-border-rigid px-6 md:px-12 flex items-center justify-between h-16 bg-surface">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold tracking-[0.25em] text-primary">
              VOUCH
            </span>
            <span className="text-[10px] font-mono text-muted-text">/</span>
          </Link>
          <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">
            Organizer Hub
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/scanner">
            <Button variant="outline" size="sm">
              📷 Fast Gate Scanner
            </Button>
          </Link>
          <Link href="/organizer/create">
            <Button variant="accent" size="sm">
              + Create Event
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 md:p-12 max-w-7xl w-full mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-rigid pb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-serif italic text-primary font-medium tracking-tight">
              Event Portfolio
            </h1>
            <p className="text-xs text-muted-text uppercase tracking-widest mt-1">
              Active check-in operations & financial monetization ledgers
            </p>
          </div>

          <Link href="/organizer/create">
            <Button variant="primary" size="md">
              + New Event Studio
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="p-16 text-center border border-border-rigid text-xs text-muted-text animate-pulse">
            Loading organizer portfolio...
          </div>
        ) : events.length === 0 ? (
          <div className="border-2 border-dashed border-border-rigid p-16 text-center space-y-4 bg-surface-low">
            <div className="text-4xl">🏛️</div>
            <h3 className="text-lg font-serif italic font-medium text-primary">
              No Events Created Yet
            </h3>
            <p className="text-xs text-muted-text max-w-md mx-auto">
              Launch your first concurrency-safe event with custom banner branding, ticket pricing, and instant gate verification.
            </p>
            <Link href="/organizer/create">
              <Button variant="accent" size="lg">
                Create Event Now
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
              const registered = event.capacity - event.spotsRemaining;
              const fillPct = Math.round((registered / event.capacity) * 100);
              const estRevenue = registered * (event.ticketPrice || 0);

              return (
                <div
                  key={event.id}
                  className="border border-border-rigid bg-surface flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Banner Preview or Fallback */}
                  {event.bannerUrl ? (
                    <div className="relative h-36 border-b border-border-rigid overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={event.bannerUrl}
                        alt={event.name}
                        className="w-full h-full object-cover object-center"
                      />
                      <div className="absolute top-2 right-2">
                        {event.ticketPrice ? (
                          <span className="text-[10px] px-2 py-0.5 bg-primary text-surface font-bold">
                            ${event.ticketPrice} {event.currency || 'USD'}
                          </span>
                        ) : (
                          <StatusChip status="FREE" variant="success" />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-14 bg-surface-high border-b border-border-rigid p-3 flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest text-muted-text">
                        EVENT ID: {event.id.slice(-6)}
                      </span>
                      {event.ticketPrice ? (
                        <span className="text-[10px] px-2 py-0.5 bg-primary text-surface font-bold">
                          ${event.ticketPrice} {event.currency || 'USD'}
                        </span>
                      ) : (
                        <StatusChip status="FREE" variant="success" />
                      )}
                    </div>
                  )}

                  {/* Card Content */}
                  <div className="p-5 space-y-4 flex-1">
                    <div>
                      <p className="text-[10px] text-muted-text uppercase tracking-widest">
                        {new Date(event.eventDate).toLocaleDateString([], {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      <h3 className="text-xl font-serif italic text-primary font-medium tracking-tight mt-0.5">
                        {event.name}
                      </h3>
                      {event.venue && (
                        <p className="text-[11px] text-muted-text mt-0.5">📍 {event.venue}</p>
                      )}
                    </div>

                    {/* Capacity and Revenue Progress */}
                    <div className="space-y-2 pt-2 border-t border-border-rigid/40">
                      <ProgressBar
                        value={fillPct}
                        label="Capacity Filled"
                        sublabel={`${registered} / ${event.capacity} seats`}
                        variant={fillPct >= 90 ? 'accent' : 'primary'}
                        height="sm"
                      />

                      {event.ticketPrice ? (
                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <span className="text-muted-text uppercase">Gross Revenue:</span>
                          <span className="font-bold text-accent">${estRevenue.toLocaleString()}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="border-t border-border-rigid p-3 bg-surface-high flex gap-2">
                    <Link href={`/organizer/events/${event.id}`} className="flex-1">
                      <Button variant="primary" size="sm" className="w-full text-[11px]">
                        Operations Hub
                      </Button>
                    </Link>
                    <Link href={`/register/${event.id}`} target="_blank">
                      <Button variant="outline" size="sm" className="text-[11px]" title="Open Attendee Registration">
                        🔗 Register
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
