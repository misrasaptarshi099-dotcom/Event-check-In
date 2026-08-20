'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Input, StatusChip, ProgressBar } from '@/components/ui';
import { EditEventModal } from '@/components/dashboard/EditEventModal';
import type { EventItem } from '@/types';

interface OrganizerRecord {
  email: string;
  addedBy: string;
  createdAt: string;
  isPrimary?: boolean;
}

export default function OrganizerDashboard() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Event Edit & Delete State
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<EventItem | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Team Management State
  const [organizers, setOrganizers] = useState<OrganizerRecord[]>([]);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [newOrganizerEmail, setNewOrganizerEmail] = useState('');
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamSuccess, setTeamSuccess] = useState<string | null>(null);

  const fetchOrganizers = async () => {
    const token = localStorage.getItem('vouch_auth_token');
    if (!token) return;

    try {
      const res = await fetch('/api/organizers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.organizers) {
        setOrganizers(data.organizers);
      }
    } catch (err) {
      console.error('Failed to load organizers:', err);
    }
  };

  const fetchEvents = async () => {
    const token = localStorage.getItem('vouch_auth_token');
    if (!token) return;

    try {
      const res = await fetch('/api/events?organizerOnly=true', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.events) {
        setEvents(data.events);
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deletingEvent) return;
    setDeleteLoading(true);

    const token = localStorage.getItem('vouch_auth_token');
    if (!token) return;

    try {
      const res = await fetch(`/api/events/${deletingEvent.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete event.');
      }

      setShowDeleteModal(false);
      setDeletingEvent(null);
      await fetchEvents();
    } catch (err: any) {
      alert(err.message || 'Failed to delete event.');
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    const role = localStorage.getItem('vouch_user_role');
    const token = localStorage.getItem('vouch_auth_token');
    const email = localStorage.getItem('vouch_user_email');
    setUserEmail(email);

    if (!token || role !== 'organizer') {
      window.location.href = '/auth/login';
      return;
    }

    fetchEvents();
    fetchOrganizers();
  }, []);

  const handleAddOrganizer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamLoading(true);
    setTeamError(null);
    setTeamSuccess(null);

    const token = localStorage.getItem('vouch_auth_token');

    try {
      const res = await fetch('/api/organizers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: newOrganizerEmail.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add organizer.');

      setTeamSuccess(`Organizer ${newOrganizerEmail} authorized successfully.`);
      setNewOrganizerEmail('');
      await fetchOrganizers();
    } catch (err: any) {
      setTeamError(err.message);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleRemoveOrganizer = async (emailToRemove: string) => {
    if (!confirm(`Are you sure you want to revoke organizer access for ${emailToRemove}?`)) return;

    setTeamLoading(true);
    setTeamError(null);
    setTeamSuccess(null);

    const token = localStorage.getItem('vouch_auth_token');

    try {
      const res = await fetch(`/api/organizers/${encodeURIComponent(emailToRemove)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove organizer.');

      setTeamSuccess(`Organizer ${emailToRemove} revoked.`);
      await fetchOrganizers();
    } catch (err: any) {
      setTeamError(err.message);
    } finally {
      setTeamLoading(false);
    }
  };

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
          {userEmail && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 border border-border-rigid bg-surface-high text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="font-semibold uppercase">ORGANIZER:</span>
              <span className="text-muted-text truncate max-w-[180px]">{userEmail}</span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTeamModal(true)}
            title="Manage Authorized Organizers"
          >
            👥 Team Access
          </Button>
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

          <div className="flex items-center gap-3">
            <Button variant="outline" size="md" onClick={() => setShowTeamModal(true)}>
              👥 Manage Organizers ({organizers.length})
            </Button>
            <Link href="/organizer/create">
              <Button variant="primary" size="md">
                + New Event Studio
              </Button>
            </Link>
          </div>
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
                  <div className="border-t border-border-rigid p-3 bg-surface-high flex items-center gap-2">
                    <Link href={`/organizer/events/${event.id}`} className="flex-1">
                      <Button variant="primary" size="sm" className="w-full text-[11px]">
                        Operations Hub
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[11px]"
                      onClick={() => {
                        setEditingEvent(event);
                        setShowEditModal(true);
                      }}
                      title="Edit event details"
                    >
                      ✏️ Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[11px] text-accent hover:border-accent"
                      onClick={() => {
                        setDeletingEvent(event);
                        setShowDeleteModal(true);
                      }}
                      title="Delete event"
                    >
                      🗑️
                    </Button>
                    <Link href={`/register/${event.id}`} target="_blank">
                      <Button variant="outline" size="sm" className="text-[11px]" title="Open Attendee Registration">
                        🔗 Pass
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Team & Organizers Management Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-surface border-2 border-border-rigid w-full max-w-xl shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-border-rigid pb-3">
              <div>
                <h3 className="text-xl font-serif italic text-primary font-medium tracking-tight">
                  Authorized Organizer Team
                </h3>
                <p className="text-[10px] text-muted-text uppercase tracking-widest mt-0.5">
                  Only existing organizers can authorize new administrative accounts
                </p>
              </div>
              <button
                onClick={() => setShowTeamModal(false)}
                className="text-xs font-mono font-bold hover:text-accent p-1 cursor-pointer"
              >
                ✕ CLOSE
              </button>
            </div>

            {teamError && (
              <div className="border border-accent bg-accent/10 p-2.5 text-xs text-accent">
                [!] {teamError}
              </div>
            )}

            {teamSuccess && (
              <div className="border border-[#15803D] bg-[#15803D]/10 p-2.5 text-xs text-[#15803D]">
                [✓] {teamSuccess}
              </div>
            )}

            {/* Add Organizer Form */}
            <form onSubmit={handleAddOrganizer} className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  label="New Organizer Google Email"
                  type="email"
                  placeholder="colleague@gmail.com"
                  value={newOrganizerEmail}
                  onChange={(e) => setNewOrganizerEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" variant="accent" size="md" loading={teamLoading}>
                + Authorize
              </Button>
            </form>

            {/* Current Organizers List */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-text font-bold block">
                Active Authorized Organizers ({organizers.length})
              </span>
              <div className="border border-border-rigid divide-y divide-border-rigid max-h-60 overflow-y-auto">
                {organizers.map((org) => (
                  <div key={org.email} className="p-3 flex items-center justify-between bg-surface-high">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary">
                          {org.email}
                        </span>
                        {org.isPrimary && (
                          <StatusChip status="PRIMARY SEED" variant="critical" />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-text">
                        Added by {org.addedBy}
                      </p>
                    </div>

                    {!org.isPrimary && (
                      <button
                        onClick={() => handleRemoveOrganizer(org.email)}
                        className="text-[10px] uppercase font-bold text-accent hover:underline cursor-pointer"
                      >
                        Revoke Access
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      <EditEventModal
        event={editingEvent}
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingEvent(null);
        }}
        onEventUpdated={() => {
          fetchEvents();
        }}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 font-mono">
          <div className="bg-surface border-2 border-border-rigid w-full max-w-md shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2 border-b border-border-rigid pb-4">
              <div className="flex items-center gap-2 text-accent text-sm font-bold uppercase tracking-wider">
                <span>⚠️</span>
                <span>Permanent Deletion</span>
              </div>
              <h3 className="text-xl font-serif italic text-primary font-medium tracking-tight">
                Delete &ldquo;{deletingEvent.name}&rdquo;?
              </h3>
              <p className="text-xs text-muted-text leading-relaxed">
                This action will permanently delete this event, all associated registrations, and check-in history from Firestore. This cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingEvent(null);
                }}
                disabled={deleteLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="accent"
                size="md"
                loading={deleteLoading}
                onClick={handleDeleteEvent}
              >
                Yes, Delete Event
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
