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
import { formatCurrency } from '@/lib/utils/format';
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

  // Roster Pagination & Filter states
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterStatusFilter, setRosterStatusFilter] = useState('all');
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterCursorHistory, setRosterCursorHistory] = useState<string[]>(['']);
  const [rosterTotalCount, setRosterTotalCount] = useState(0);
  const [rosterHasMore, setRosterHasMore] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(false);

  // Edit, Delete, and Cancel Registration Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [cancellingReg, setCancellingReg] = useState<Registration | null>(null);
  const [cancelRegLoading, setCancelRegLoading] = useState(false);
  const [cancelRegError, setCancelRegError] = useState<string | null>(null);

  const fetchRoster = React.useCallback(async (
    page: number = 1,
    cursor?: string,
    search: string = rosterSearch,
    status: string = rosterStatusFilter
  ) => {
    setRosterLoading(true);
    try {
      const token = await getFreshAuthToken();
      if (!token) return;

      const params = new URLSearchParams({
        pageSize: '50',
      });
      if (cursor) params.set('cursor', cursor);
      if (search.trim()) params.set('search', search.trim());
      if (status && status !== 'all') params.set('status', status);

      const res = await fetch(`/api/events/${eventId}/roster?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setRegistrations(data.roster || []);
        setRosterTotalCount(data.totalCount || 0);
        setRosterHasMore(Boolean(data.hasMore));
        setRosterPage(page);

        if (data.nextCursor) {
          setRosterCursorHistory((prev) => {
            const nextHistory = [...prev];
            nextHistory[page] = data.nextCursor;
            return nextHistory;
          });
        }
      }
    } catch (e) {
      console.error('Failed to fetch paginated roster:', e);
    } finally {
      setRosterLoading(false);
    }
  }, [eventId, rosterSearch, rosterStatusFilter]);

  const fetchData = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const token = await getFreshAuthToken();

      if (!token) {
        window.location.href = '/auth/login';
        return;
      }

      const authHeader = { Authorization: `Bearer ${token}` };

      // 1. Fetch Event details & Stats
      const [eventRes, statsRes] = await Promise.all([
        fetch(`/api/events/${eventId}?organizerOnly=true`, { headers: authHeader, signal }),
        fetch(`/api/events/${eventId}/stats`, { headers: authHeader, signal }),
      ]);

      if (eventRes.status === 401 || eventRes.status === 403) throw new Error('Your organizer session has expired. Please sign in again.');
      if (!eventRes.ok) { const eventError = await eventRes.json().catch(() => null); throw new Error(eventError?.error || 'Event not found.'); }
      if (!statsRes.ok) { const statsError = await statsRes.json().catch(() => null); throw new Error(statsError?.error || 'Unable to load event operations.'); }
      const eventData = await eventRes.json();
      const statsData = await statsRes.json();

      setEvent(eventData.event);
      setStats(statsData.stats);

      // 2. Fetch Finance
      const finRes = await fetch(`/api/events/${eventId}/finance`, { headers: authHeader, signal });
      if (finRes.ok) {
        const finData = await finRes.json();
        setFinance(finData.finance);
      }

      // 3. Fetch Initial Roster
      const rosterRes = await fetch(`/api/events/${eventId}/roster?pageSize=50`, { headers: authHeader, signal });
      if (rosterRes.ok) {
        const rosterData = await rosterRes.json();
        setRegistrations(rosterData.roster || []);
        setRosterTotalCount(rosterData.totalCount || 0);
        setRosterHasMore(Boolean(rosterData.hasMore));
        if (rosterData.nextCursor) {
          setRosterCursorHistory(['', rosterData.nextCursor]);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Failed to load event dashboard.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const handleDeleteEvent = async () => {
    setDeleteLoading(true);
    setDeleteError(null);

    const token = await getFreshAuthToken();
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

  const handleCancelRegistration = async () => {
    if (!cancellingReg) return;
    setCancelRegLoading(true);
    setCancelRegError(null);

    try {
      const token = await getFreshAuthToken();
      const res = await fetch(`/api/registrations/${cancellingReg.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel registration.');
      }

      setCancellingReg(null);
      fetchRoster(rosterPage);
      fetchData();
    } catch (err: any) {
      setCancelRegError(err.message || 'Error cancelling registration.');
    } finally {
      setCancelRegLoading(false);
    }
  };

  useEffect(() => {
    if (showEditModal) {
      return;
    }

    const controller = new AbortController();
    fetchData(controller.signal);

    // Auto-refresh stats every 10 seconds during active event
    const interval = setInterval(() => {
      fetchData(controller.signal);
    }, 10000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchData, showEditModal]);

  const totalBookedSeats = registrations
    .filter((r) => r.status !== 'cancelled')
    .reduce((sum, r) => sum + (r.guestCount || 1), 0);

  const tabs = [
    { id: 'operations', label: '📊 Operations & Live Gate', badge: stats ? `${stats.checkedInCount}/${stats.registeredCount}` : undefined },
    { id: 'finance', label: '💰 Finance & Revenue', badge: finance ? `$${finance.grossRevenue.toLocaleString()}` : undefined },
    { id: 'ai', label: '🧠 Gemini AI Intelligence' },
    { id: 'roster', label: '👥 Attendee Roster', badge: totalBookedSeats > 0 ? `${totalBookedSeats} Seats` : undefined },
    { id: 'conflicts', label: '⚡ Sync & Conflicts', badge: syncLogs.length > 0 ? syncLogs.length : undefined },
  ];

  const isEventConcluded = stats?.isEventFinished ?? (
    event?.eventEndDate
      ? new Date(event.eventEndDate).getTime() <= Date.now()
      : false
  );

  const rosterColumns: Column<Registration>[] = [
    {
      key: 'id',
      header: 'Reg ID',
      render: (r) => <span className="font-mono text-[10px] text-muted-text">{r.id.slice(-8)}</span>,
    },
    {
      key: 'attendeeName',
      header: 'Attendee Name',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${r.status === 'cancelled' ? 'text-muted-text line-through' : 'text-primary'}`}>{r.attendeeName}</span>
          {(r.guestCount ?? 1) > 1 && (
            <span className="text-[10px] px-1 py-0.5 border border-border-rigid bg-surface-high text-muted-text">
              +{r.guestCount! - 1} Guests
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'attendeeEmail',
      header: 'Email',
      render: (r) => <span className="text-xs text-muted-text">{r.attendeeEmail}</span>,
    },
    {
      key: 'status',
      header: 'Lifecycle Status',
      render: (r) => {
        let statusText = 'CONFIRMED';
        let variant: 'neutral' | 'success' | 'danger' | 'warning' = 'neutral';

        if (r.status === 'cancelled') {
          statusText = 'CANCELLED';
          variant = 'danger';
        } else if (r.checkedIn) {
          statusText = isEventConcluded ? 'ATTENDED' : 'CHECKED IN';
          variant = 'success';
        } else if (isEventConcluded) {
          statusText = 'NO SHOW';
          variant = 'danger';
        }

        return <StatusChip status={statusText} variant={variant} />;
      },
    },
    {
      key: 'paymentStatus',
      header: 'Payment / Refund',
      render: (r) => {
        const seats = r.guestCount || 1;
        const unitPrice = r.ticketPrice !== undefined ? r.ticketPrice : (event?.ticketPrice || 0);
        const total = unitPrice * seats;

        if (r.status === 'cancelled') {
          return (
            <StatusChip
              status={total > 0 ? `REFUNDED (${formatCurrency(total, event?.currency)})` : 'CANCELLED (FREE)'}
              variant="danger"
            />
          );
        }

        if (total > 0) {
          return (
            <StatusChip
              status={`PAID (${formatCurrency(total, event?.currency)})`}
              variant="success"
            />
          );
        }

        return <StatusChip status="FREE" variant="neutral" />;
      },
    },
    {
      key: 'checkedInAt',
      header: 'Admitted At',
      render: (r) => (
        <span className="text-[10px] text-muted-text font-mono">
          {r.checkedInAt ? new Date(r.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Registered',
      render: (r) => (
        <span className="text-[10px] text-muted-text">
          {r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => {
        if (r.status === 'cancelled') {
          return (
            <span className="text-[10px] text-muted-text italic">
              Cancelled
            </span>
          );
        }

        if (r.checkedIn) {
          return (
            <span className="text-[10px] text-success font-semibold">
              Admitted
            </span>
          );
        }

        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCancellingReg(r);
              setCancelRegError(null);
            }}
            className="text-[10px] py-1 px-2 border-accent/40 text-accent hover:bg-accent hover:text-surface"
          >
            Cancel & Refund
          </Button>
        );
      },
    },
  ];

  if (loading || (!event && !error)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-mono bg-surface text-primary p-6 space-y-4 animate-in fade-in duration-200">
        <div className="w-8 h-8 border-2 border-primary animate-spin" />
        <div className="border border-border-rigid p-6 text-center space-y-1 bg-surface-low shadow-sm max-w-sm w-full">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            INITIALIZING OPERATIONS HUB
          </p>
          <p className="text-[10px] text-muted-text">
            Connecting to live event telemetry and roster...
          </p>
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
          <div id="panel-operations" role="tabpanel" aria-labelledby="tab-operations" className="space-y-6 animate-in fade-in duration-150">
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
          <div id="panel-finance" role="tabpanel" aria-labelledby="tab-finance" className="animate-in fade-in duration-150">
            <FinanceAnalyticsView finance={finance} eventId={event.id} />
          </div>
        )}

        {/* 3. GEMINI AI INTELLIGENCE TAB */}
        {activeTab === 'ai' && (
          <div id="panel-ai" role="tabpanel" aria-labelledby="tab-ai" className="animate-in fade-in duration-150">
            <AiInsightsTerminal eventId={event.id} />
          </div>
        )}

        {/* 4. ATTENDEE ROSTER TAB */}
        {activeTab === 'roster' && (
          <div id="panel-roster" role="tabpanel" aria-labelledby="tab-roster" className="space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                onClick={async () => {
                  try {
                    const token = await getFreshAuthToken();
                    const res = await fetch(`/api/events/${event.id}/export`, {
                      headers: token ? { Authorization: `Bearer ${token}` } : {},
                    });
                    if (!res.ok) throw new Error('Failed to download export');
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${event.name.replace(/[^a-z0-9]/gi, '_')}_export.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                  } catch (e) {
                    console.error('Export download failed:', e);
                  }
                }}
              >
                📥 Export Attendee CSV
              </Button>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-surface border border-border-rigid p-3">
              <div className="sm:col-span-8">
                <input
                  type="text"
                  placeholder="Search by attendee name, email, or registration ID..."
                  value={rosterSearch}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRosterSearch(val);
                    fetchRoster(1, undefined, val, rosterStatusFilter);
                  }}
                  className="w-full bg-surface-low border border-border-rigid px-3 py-2 text-xs font-mono text-primary placeholder:text-muted-text focus:outline-none focus:border-primary rounded-none"
                />
              </div>
              <div className="sm:col-span-4">
                <select
                  value={rosterStatusFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRosterStatusFilter(val);
                    fetchRoster(1, undefined, rosterSearch, val);
                  }}
                  className="w-full bg-surface-low border border-border-rigid px-3 py-2 text-xs font-mono text-primary focus:outline-none focus:border-primary rounded-none"
                >
                  <option value="all">All Attendees</option>
                  <option value="confirmed">Confirmed (Unscanned)</option>
                  <option value="checked_in">Checked In / Attended</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {rosterLoading ? (
              <div className="p-12 border border-border-rigid text-center flex flex-col items-center justify-center space-y-3 bg-surface">
                <span className="w-6 h-6 border-2 border-primary animate-spin" />
                <span className="text-xs text-muted-text uppercase tracking-widest">Querying attendee roster ledger...</span>
              </div>
            ) : (
              <Table
                columns={rosterColumns}
                data={registrations}
                keyExtractor={(r) => r.id}
                emptyMessage="No attendees matched your search/filter criteria."
              />
            )}

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border border-border-rigid p-3 bg-surface text-xs font-mono">
              <div className="text-muted-text">
                Showing{' '}
                <span className="text-primary font-bold">
                  {registrations.length > 0 ? (rosterPage - 1) * 50 + 1 : 0}–{(rosterPage - 1) * 50 + registrations.length}
                </span>{' '}
                of <span className="text-primary font-bold">{rosterTotalCount}</span> attendees
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={rosterPage <= 1 || rosterLoading}
                  onClick={() => {
                    const prevPage = rosterPage - 1;
                    const prevCursor = prevPage > 1 ? rosterCursorHistory[prevPage - 1] : undefined;
                    fetchRoster(prevPage, prevCursor);
                  }}
                >
                  ◀ Previous
                </Button>

                <span className="px-2 font-bold text-primary">
                  Page {rosterPage} of {Math.max(1, Math.ceil(rosterTotalCount / 50))}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={!rosterHasMore || rosterLoading}
                  onClick={() => {
                    const nextPage = rosterPage + 1;
                    const currentCursor = rosterCursorHistory[rosterPage];
                    fetchRoster(nextPage, currentCursor);
                  }}
                >
                  Next ▶
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 5. SYNC & CONFLICTS TAB */}
        {activeTab === 'conflicts' && (
          <div id="panel-conflicts" role="tabpanel" aria-labelledby="tab-conflicts" className="animate-in fade-in duration-150">
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

      {/* Cancel Registration & Refund Modal */}
      {cancellingReg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 font-mono">
          <div className="bg-surface border-2 border-border-rigid w-full max-w-md shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2 border-b border-border-rigid pb-4">
              <div className="flex items-center gap-2 text-accent text-sm font-bold uppercase tracking-wider">
                <span>🚫</span>
                <span>Cancel & Refund Reservation</span>
              </div>
              <h3 className="text-xl font-serif italic text-primary font-medium tracking-tight">
                Cancel pass for &ldquo;{cancellingReg.attendeeName}&rdquo;?
              </h3>
              <p className="text-xs text-muted-text leading-relaxed">
                This will void the attendee&apos;s dynamic QR token, release {cancellingReg.guestCount || 1} seat(s) back to the event capacity, and record a refund transaction in the ledger.
              </p>
            </div>

            <div className="p-4 bg-surface-low border border-border-rigid space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-text">Attendee:</span>
                <span className="font-bold text-primary">{cancellingReg.attendeeName} ({cancellingReg.attendeeEmail})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-text">Seats Released:</span>
                <span className="font-bold text-primary">{cancellingReg.guestCount || 1} Seat(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-text">Refund Value:</span>
                <span className="font-bold text-accent">
                  {(() => {
                    const seats = cancellingReg.guestCount || 1;
                    const price = cancellingReg.ticketPrice !== undefined ? cancellingReg.ticketPrice : (event?.ticketPrice || 0);
                    return price * seats > 0 ? formatCurrency(price * seats, event?.currency) : 'Free Admission';
                  })()}
                </span>
              </div>
            </div>

            {cancelRegError && (
              <div className="border border-accent bg-accent/10 p-2.5 text-xs text-accent">
                [!] {cancelRegError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => {
                  setCancellingReg(null);
                  setCancelRegError(null);
                }}
                disabled={cancelRegLoading}
              >
                Keep Active
              </Button>
              <Button
                type="button"
                variant="accent"
                size="md"
                loading={cancelRegLoading}
                onClick={handleCancelRegistration}
              >
                Yes, Cancel & Refund
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
