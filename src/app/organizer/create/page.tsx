'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input, ImageUpload, StatusChip } from '@/components/ui';

export default function CreateEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    const role = localStorage.getItem('vouch_user_role');
    const token = localStorage.getItem('vouch_auth_token');

    if (!token || role !== 'organizer') {
      window.location.href = '/auth/login';
    }
  }, []);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [venue, setVenue] = useState('');
  const [capacity, setCapacity] = useState('100');
  const [ticketPrice, setTicketPrice] = useState('0');
  const [currency, setCurrency] = useState('USD');
  const [bannerUrl, setBannerUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('vouch_auth_token');
      if (!token) {
        throw new Error('You must be signed in as an organizer to create events.');
      }

      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          eventDate,
          timezone,
          venue: venue.trim() || undefined,
          capacity: Number(capacity),
          ticketPrice: Number(ticketPrice),
          currency,
          bannerUrl: bannerUrl || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create event.');
      }

      router.push(`/organizer/events/${data.event.id}`);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-mono bg-surface text-primary">
      {/* Top Header */}
      <header className="border-b border-border-rigid px-6 md:px-12 flex items-center justify-between h-16 bg-surface">
        <div className="flex items-center gap-3">
          <Link href="/organizer" className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold tracking-[0.25em] text-primary">
              VOUCH
            </span>
            <span className="text-[10px] font-mono text-muted-text">/</span>
          </Link>
          <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">
            Event Creation Studio
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/organizer">
            <Button variant="outline" size="sm">
              Cancel & Return
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              localStorage.removeItem('vouch_user_role');
              localStorage.removeItem('vouch_user_uid');
              localStorage.removeItem('vouch_user_email');
              localStorage.removeItem('vouch_auth_token');
              window.location.href = '/';
            }}
          >
            Logout
          </Button>
        </div>
      </header>

      {/* Main Studio Grid */}
      <main className="flex-1 p-6 md:p-12 max-w-7xl w-full mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Form Column (7 cols) */}
          <div className="lg:col-span-7 border-2 border-border-rigid p-6 sm:p-8 bg-surface shadow-md space-y-6">
            <div className="border-b border-border-rigid pb-4">
              <h1 className="text-2xl sm:text-3xl font-serif italic text-primary font-medium tracking-tight">
                Launch New Event
              </h1>
              <p className="text-[11px] text-muted-text uppercase tracking-wider mt-1">
                Configure concurrency capacity, dynamic ticketing, and branding banner
              </p>
            </div>

            {error && (
              <div className="border border-accent bg-accent/10 p-3 text-xs text-accent">
                [!] {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Event Name */}
              <Input
                label="Event Title"
                placeholder="e.g. Future of Systems Architecture 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              {/* Description */}
              <div className="space-y-1.5 font-mono">
                <label className="text-[10px] uppercase tracking-widest text-muted-text font-medium block">
                  Event Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Keynote topics, agenda highlights, and VIP instructions..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-transparent border border-border-rigid p-3 text-xs font-mono text-primary placeholder:text-muted-text focus:outline-none focus:border-b-2 focus:border-primary rounded-none"
                />
              </div>

              {/* Banner Image Upload */}
              <ImageUpload
                label="Event Banner Visual (Shown on Passes & Registration)"
                value={bannerUrl}
                onChange={(url) => setBannerUrl(url)}
                onClear={() => setBannerUrl('')}
              />

              {/* Date & Timezone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Event Date & Time"
                  type="datetime-local"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  required
                />

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-muted-text font-medium block">
                    Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full h-14 bg-transparent border-b border-border-rigid px-0 py-2 text-sm font-mono text-primary focus:outline-none focus:border-b-2 focus:border-primary rounded-none"
                  >
                    <option value="America/New_York">America / New York (EST)</option>
                    <option value="America/Los_Angeles">America / Los Angeles (PST)</option>
                    <option value="America/Chicago">America / Chicago (CST)</option>
                    <option value="Europe/London">Europe / London (GMT/BST)</option>
                    <option value="Europe/Berlin">Europe / Berlin (CET)</option>
                    <option value="Asia/Tokyo">Asia / Tokyo (JST)</option>
                    <option value="Asia/Kolkata">Asia / Kolkata (IST)</option>
                    <option value="UTC">UTC Standard</option>
                  </select>
                </div>
              </div>

              {/* Venue / Location */}
              <Input
                label="Venue / Location"
                placeholder="e.g. Metropol Hall, San Francisco or Virtual"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
              />

              {/* Capacity & Pricing */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-border-rigid pt-4">
                <Input
                  label="Seat Capacity (Atomic)"
                  type="number"
                  min="1"
                  max="100000"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  hint="Strictly enforced limit"
                  required
                />

                <Input
                  label="Ticket Price"
                  type="number"
                  min="0"
                  step="1"
                  value={ticketPrice}
                  onChange={(e) => setTicketPrice(e.target.value)}
                  hint="0 = Free Admission"
                  required
                />

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-muted-text font-medium block">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full h-14 bg-transparent border-b border-border-rigid px-0 py-2 text-sm font-mono text-primary focus:outline-none focus:border-b-2 focus:border-primary rounded-none"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>
              </div>

              <Button
                type="submit"
                variant="accent"
                size="lg"
                loading={loading}
                className="w-full text-sm font-bold uppercase tracking-wider mt-4"
              >
                Publish Event & Initialize Ledger
              </Button>
            </form>
          </div>

          {/* Right Live Simulation Column (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-muted-text font-medium">
                Live Digital Pass Simulation
              </span>
              <StatusChip status="PREVIEW" variant="neutral" />
            </div>

            {/* Simulated Live Ticket Card */}
            <div className="border-2 border-border-rigid bg-surface shadow-xl p-5 space-y-4">
              {bannerUrl ? (
                <div className="h-32 w-full border border-border-rigid overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bannerUrl}
                    alt="Banner Preview"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              ) : (
                <div className="h-12 bg-primary flex items-center justify-between px-4 text-surface text-xs uppercase font-bold tracking-widest">
                  <span>VOUCH // PASS</span>
                  <span>{ticketPrice !== '0' ? `$${ticketPrice} ${currency}` : 'FREE'}</span>
                </div>
              )}

              <div>
                <p className="text-[10px] text-muted-text uppercase tracking-widest">
                  {eventDate ? new Date(eventDate).toLocaleDateString() : 'DATE TBD'} · {timezone}
                </p>
                <h3 className="text-xl font-serif italic text-primary font-medium tracking-tight mt-0.5">
                  {name || 'Your Event Title Will Appear Here'}
                </h3>
                <p className="text-xs text-muted-text mt-1">
                  📍 {venue || 'Location will appear here'}
                </p>
              </div>

              <div className="border-y border-dashed border-border-rigid py-3 flex justify-between text-xs">
                <div>
                  <span className="text-[9px] uppercase text-muted-text block">CAPACITY</span>
                  <span className="font-bold text-primary">{capacity || '100'} SEATS</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase text-muted-text block">TICKET PRICE</span>
                  <span className="font-bold text-accent">
                    {ticketPrice !== '0' ? `$${ticketPrice} ${currency}` : 'FREE ADMISSION'}
                  </span>
                </div>
              </div>

              <div className="p-4 border border-border-rigid bg-surface-high text-center text-xs space-y-1">
                <div className="text-2xl">📱</div>
                <p className="font-semibold text-primary">Dynamic RFC 6238 TOTP QR Code</p>
                <p className="text-[10px] text-muted-text">
                  Automatically generated with 30s rotation upon attendee registration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
