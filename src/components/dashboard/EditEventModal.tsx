'use client';

import React, { useState, useEffect } from 'react';
import { Button, Input, ImageUpload } from '@/components/ui';
import type { EventItem } from '@/types';

interface EditEventModalProps {
  event: EventItem | null;
  isOpen: boolean;
  onClose: () => void;
  onEventUpdated: (updated: EventItem) => void;
}

function toLocalDatetimeString(isoDate?: string): string {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    // Format YYYY-MM-DDTHH:mm
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
}

export function EditEventModal({ event, isOpen, onClose, onEventUpdated }: EditEventModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [venue, setVenue] = useState('');
  const [capacity, setCapacity] = useState('100');
  const [ticketPrice, setTicketPrice] = useState('0');
  const [currency, setCurrency] = useState('USD');
  const [bannerUrl, setBannerUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (event) {
      setName(event.name || '');
      setDescription(event.description || '');
      setEventDate(toLocalDatetimeString(event.eventDate));
      setEventEndDate(toLocalDatetimeString(event.eventEndDate));
      setTimezone(event.timezone || 'UTC');
      setVenue(event.venue || '');
      setCapacity(String(event.capacity || 100));
      setTicketPrice(String(event.ticketPrice ?? 0));
      setCurrency(event.currency || 'USD');
      setBannerUrl(event.bannerUrl || '');
      setError(null);
    }
  }, [event]);

  if (!isOpen || !event) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('vouch_auth_token');
    if (!token) {
      setError('You must be signed in as an organizer.');
      setLoading(false);
      return;
    }

    if (eventEndDate && new Date(eventEndDate).getTime() < new Date(eventDate).getTime()) {
      setError('Event end time cannot be before start time.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          eventDate: eventDate ? new Date(eventDate).toISOString() : undefined,
          eventEndDate: eventEndDate ? new Date(eventEndDate).toISOString() : null,
          timezone,
          venue: venue.trim(),
          capacity: Number(capacity),
          ticketPrice: Number(ticketPrice),
          currency,
          bannerUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update event.');
      if (!data.event) throw new Error('Malformed update response from server.');

      onEventUpdated(data.event);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating event.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-surface border-2 border-border-rigid w-full max-w-3xl shadow-2xl p-6 sm:p-8 space-y-6 my-8 max-h-[90vh] overflow-y-auto font-mono">
        <div className="flex items-center justify-between border-b border-border-rigid pb-4">
          <div>
            <h2 className="text-2xl font-serif italic text-primary font-medium tracking-tight">
              Edit Event Configuration
            </h2>
            <p className="text-[10px] text-muted-text uppercase tracking-widest mt-0.5">
              Update timing, capacity, ticketing, and event branding
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xs font-mono font-bold hover:text-accent p-1 cursor-pointer"
          >
            ✕ CLOSE
          </button>
        </div>

        {error && (
          <div className="border border-accent bg-accent/10 p-3 text-xs text-accent">
            [!] {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Event Title */}
          <Input
            label="Event Title"
            placeholder="Event Title"
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
            label="Event Banner Visual"
            value={bannerUrl}
            onChange={(url) => setBannerUrl(url)}
            onClear={() => setBannerUrl('')}
          />

          {/* Date, End Date & Timezone */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Start Date & Time"
              type="datetime-local"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />

            <Input
              label="End Date & Time"
              type="datetime-local"
              value={eventEndDate}
              onChange={(e) => setEventEndDate(e.target.value)}
              hint="For accurate no-show calculation"
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
            placeholder="e.g. MG Auditorium or Online"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
          />

          {/* Capacity & Pricing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-border-rigid pt-4">
            <Input
              label="Seat Capacity"
              type="number"
              min="1"
              max="100000"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              hint="Atomic capacity update"
              required
            />

            <Input
              label="Ticket Price"
              type="number"
              min="0"
              step="1"
              value={ticketPrice}
              onChange={(e) => setTicketPrice(e.target.value)}
              hint="0 = Free"
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

          {/* Action Row */}
          <div className="flex items-center justify-end gap-3 border-t border-border-rigid pt-4">
            <Button type="button" variant="outline" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" size="md" loading={loading}>
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
