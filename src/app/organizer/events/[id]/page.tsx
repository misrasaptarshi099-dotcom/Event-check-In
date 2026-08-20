'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { getFreshAuthToken } from '@/lib/firebase/client';
import { Button, StatusChip, Tabs, Table, type Column } from '@/components/ui';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { CheckinHistogram } from '@/components/dashboard/CheckinHistogram';
import { FinanceAnalyticsView } from '@/components/dashboard/FinanceAnalyticsView';
import { AiInsightsTerminal } from '@/components/dashboard/AiInsightsTerminal';
import { SyncConflictDrawer } from '@/components/dashboard/SyncConflictDrawer';
import { EditEventModal } from '@/components/dashboard/EditEventModal';
import type { EventItem, StatsBundle, FinanceBundle, Registration, CheckinSyncLog } from '@/types';

interface PageParams {
  params: Promise<{ id: string }>;
}

export default function EventDashboardPage({ params }: PageParams) {
  const { id: eventId } = use(params);

  const [activeTab, setActiveTab] = useState<string>('operations');
  const [event, setEvent] = useState<EventItem | null>(null);
  const [stats, setStats] = useState<StatsBundle | null>(null);
  const [finance, setFinance] = useState<FinanceBundle | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [syncLogs, setSyncLogs] = useState<CheckinSyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit & Delete Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      const token = await getFreshAuthToken();

      if (!token) {
        window.location.href = '/auth/login';
        return;
      }

      const authHeader = { Authorization: `Bearer ${token}` };

      // 1. Fetch Event details & Stats
      const [eventRes, statsRes] = await Promise.all([
        fetch(`/api/events/${eventId}`, { headers: authHeader }),
        fetch(`/api/events/${eventId}/stats`, { headers: authHeader }),
      ]);

      if (!eventRes.ok) throw new Error('Event not found.');
      const eventData = await eventRes.json();
      const statsData = await statsRes.json();

      setEvent(eventData.event);
      setStats(statsData.stats);

      // 2. Fetch Finance
      const finRes = await fetch(`/api/events/${eventId}/finance`, { headers: authHeader });
      if (finRes.ok) {
        const finData = await finRes.json();
        setFinance(finData.finance);
      }

      // 3. Fetch Roster
      const rosterRes = await fetch(`/api/events/${eventId}/roster`, { headers: authHeader });
      if (rosterRes.ok) {
        const rosterData = await rosterRes.json();
        setRegistrations(rosterData.roster || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load event dashboard.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const handleDeleteEvent = async () => {
    setDeleteLoading(true);
    setDeleteError(null);

    const token = localStorage.getItem('vouch_auth_token');
    if (!token) {
      setDeleteError('Authentication required.');
      setDeleteLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete event.');
      }

      window.location.href = '/organizer';
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete event.');
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh stats every 10 seconds during active event
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const tabs = [
    { id: 'operations', label: '📊 Operations & Live Gate', badge: stats ? `${stats.checkedInCount}/${stats.registeredCount}` : undefined },
    { id: 'finance', label: '💰 Finance & Revenue', badge: finance ? `$${finance.grossRevenue.toLocaleString()}` : undefined },
    { id: 'ai', label: '🧠 Gemini AI Intelligence' },
    { id: 'roster', label: '👥 Attendee Roster', badge: registrations.length },
    { id: 'conflicts', label: '⚡ Sync & Conflicts', badge: syncLogs.length > 0 ? syncLogs.length : undefined },
  ];

  const rosterColumns: Column<Registration>[] = [
    {
      key: 'id',
      header: 'Reg ID',
      render: (r) => <span className="font-mono text-[10px] text-muted-text">{r.id}</span>,
    },
    {
      key: 'attendeeName',
      header: 'Attendee Name',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-primary">{r.attendeeName}</span>
          {(r.guestCount ?? 1) > 1 && (
            <span className="text-[9px] font-bold bg-primary text-surface px-1.5 py-0.5 uppercase tracking-wider">
              +{r.guestCount - 1} {r.guestCount === 2 ? 'Guest' : 'Guests'}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'attendeeEmail',
      header: 'Email',
      render: (r) => <span className="text-[11px] text-muted-text">{r.attendeeEmail}</span>,
    },
    {
      key: 'guestCount',
      header: 'Seats',
      align: 'center',
      render: (r) => (
        <span className="font-bold text-xs text-primary">
          {r.guestCount ?? 1}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (r) => (
        <StatusChip
          status={r.status.toUpperCase()}
          variant={r.status === 'active' ? 'success' : 'danger'}
        />
      ),
    },
    {
      key: 'createdAt',
      header: 'Registered At',
      align: 'right',
      render: (r) => (
        <span className="text-[10px] text-muted-text">
          {r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono bg-surface text-primary p-6">
        <div className="border border-border-rigid p-8 text-center text-xs animate-pulse">
          Connecting to live Firestore operations hub...
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-mono bg-surface text-primary p-6 space-y-4">
        <div className="border border-accent bg-accent/10 p-6 text-sm text-accent max-w-md text-center">
          [!] {error || 'Event not found.'}
        </div>
        <Link href="/organizer">
          <Button variant="secondary" size="md">Return to Organizer Hub</Button>
        </Link>
      </div>
    );
  }

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
          <span className="text-xs uppercase tracking-widest text-primary font-semibold truncate max-w-xs">
            {event.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEditModal(true)}
            title="Edit event settings, capacity and pricing"
          >
            ✏️ Edit Event
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
            className="text-accent hover:border-accent"
            title="Delete this event"
          >
            🗑️ Delete
          </Button>
          <Link href="/scanner">
            <Button variant="outline" size="sm">
              📷 Open Scanner
            </Button>
          </Link>
          <Link href={`/register/${event.id}`} target="_blank">
            <Button variant="secondary" size="sm">
              🔗 Registration Pass
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

      {/* Hero Banner Header or Info Header */}
      {event.bannerUrl ? (
        <div className="h-32 w-full border-b border-border-rigid relative overflow-hidden bg-primary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.bannerUrl}
            alt={event.name}
            className="w-full h-full object-cover object-center opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/80 to-transparent p-6 flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-text uppercase tracking-widest">
                {new Date(event.eventDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · {new Date(event.eventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {event.eventEndDate ? ` — ${new Date(event.eventEndDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''} · {event.timezone || 'UTC'}
              </p>
              <StatusChip
                status={stats?.isEventFinished ? 'CONCLUDED' : (new Date().getTime() >= new Date(event.eventDate).getTime() ? 'LIVE NOW' : 'UPCOMING')}
                variant={stats?.isEventFinished ? 'neutral' : (new Date().getTime() >= new Date(event.eventDate).getTime() ? 'success' : 'neutral')}
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif italic text-primary font-medium tracking-tight mt-1">
              {event.name}
            </h1>
          </div>
        </div>
      ) : (
        <div className="border-b border-border-rigid px-6 md:px-12 py-4 bg-surface-low flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-text uppercase tracking-widest">
                {new Date(event.eventDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · {new Date(event.eventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {event.eventEndDate ? ` — ${new Date(event.eventEndDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''} · {event.timezone || 'UTC'}
              </p>
              <StatusChip
                status={stats?.isEventFinished ? 'CONCLUDED' : (new Date().getTime() >= new Date(event.eventDate).getTime() ? 'LIVE NOW' : 'UPCOMING')}
                variant={stats?.isEventFinished ? 'neutral' : (new Date().getTime() >= new Date(event.eventDate).getTime() ? 'success' : 'neutral')}
              />
            </div>
            <h1 className="text-2xl font-serif italic text-primary font-medium tracking-tight mt-0.5">
              {event.name}
            </h1>
          </div>
        </div>
      )}

      {/* Tabs Navigation Bar */}
      <div className="border-b border-border-rigid bg-surface">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="px-6 md:px-12" />
      </div>

      {/* Main Content Viewport */}
      <main className="flex-1 p-6 md:px-12 md:py-8 max-w-7xl w-full mx-auto space-y-6">
        {/* 1. OPERATIONS TAB */}
        {activeTab === 'operations' && stats && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Live KPI Metric Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Total Registered"
                value={`${stats.registeredCount} / ${stats.capacity}`}
                sublabel={`${stats.spotsRemaining} spots available`}
                variant="neutral"
              />
              <MetricCard
                label="Checked-In (Admitted)"
                value={stats.checkedInCount}
                sublabel={`${stats.registeredCount > 0 ? Math.round((stats.checkedInCount / stats.registeredCount) * 100) : 0}% attendance rate`}
                variant="accent"
              />
              <MetricCard
                label="No-Show Rate"
                value={stats.isEventFinished ? `${stats.noShowPct ?? 0}%` : 'PENDING'}
                sublabel={
                  stats.isEventFinished
                    ? `${stats.noShowCount} absent registrants`
                    : 'Calculated after event concludes'
                }
                variant={stats.isEventFinished && (stats.noShowPct ?? 0) > 20 ? 'accent' : 'neutral'}
              />
              <MetricCard
                label="Peak Rush Hour"
                value={stats.peakCheckinBucket}
                sublabel={`${stats.peakCheckinCount} check-ins in 15 mins`}
                variant="neutral"
              />
            </div>

            {/* Check-In Velocity Distribution Histogram */}
            <CheckinHistogram
              buckets={stats.checkinsBy15Min}
              peakBucket={stats.peakCheckinBucket}
              peakCount={stats.peakCheckinCount}
            />
          </div>
        )}

        {/* 2. FINANCE TAB */}
        {activeTab === 'finance' && finance && (
          <div className="animate-in fade-in duration-150">
            <FinanceAnalyticsView finance={finance} eventId={event.id} />
          </div>
        )}

        {/* 3. GEMINI AI INTELLIGENCE TAB */}
        {activeTab === 'ai' && (
          <div className="animate-in fade-in duration-150">
            <AiInsightsTerminal eventId={event.id} />
          </div>
        )}

        {/* 4. ATTENDEE ROSTER TAB */}
        {activeTab === 'roster' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-serif italic text-primary font-medium tracking-tight">
                  Attendee Ledger Roster
                </h4>
                <p className="text-[10px] text-muted-text uppercase tracking-widest mt-0.5">
                  Authoritative registration list and security token status
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(`/api/events/${event.id}/export`, '_blank')}
              >
                📥 Export Attendee CSV
              </Button>
            </div>

            <Table
              columns={rosterColumns}
              data={registrations}
              keyExtractor={(r) => r.id}
              emptyMessage="No attendees registered yet."
            />
          </div>
        )}

        {/* 5. SYNC & CONFLICTS TAB */}
        {activeTab === 'conflicts' && (
          <div className="animate-in fade-in duration-150">
            <SyncConflictDrawer logs={syncLogs} />
          </div>
        )}
      </main>

      {/* Edit Event Modal */}
      <EditEventModal
        event={event}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onEventUpdated={(updated) => {
          setEvent(updated);
          fetchData();
        }}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 font-mono">
          <div className="bg-surface border-2 border-border-rigid w-full max-w-md shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2 border-b border-border-rigid pb-4">
              <div className="flex items-center gap-2 text-accent text-sm font-bold uppercase tracking-wider">
                <span>⚠️</span>
                <span>Permanent Deletion</span>
              </div>
              <h3 className="text-xl font-serif italic text-primary font-medium tracking-tight">
                Delete &ldquo;{event.name}&rdquo;?
              </h3>
              <p className="text-xs text-muted-text leading-relaxed">
                This action will permanently delete this event, all associated digital passes, and gate check-in logs from Firestore. This cannot be undone.
              </p>
            </div>

            {deleteError && (
              <div className="border border-accent bg-accent/10 p-2.5 text-xs text-accent">
                [!] {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setShowDeleteModal(false)}
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
