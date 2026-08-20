'use client';

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { MetricCard } from './MetricCard';
import { Table, type Column } from '../ui/Table';
import { Button } from '../ui/Button';
import { StatusChip } from '../ui/StatusChip';
import { ProgressBar } from '../ui/Progress';
import type { FinanceBundle, TransactionEntry } from '@/types';

export interface FinanceAnalyticsViewProps {
  finance: FinanceBundle;
  eventId: string;
  className?: string;
}

export function FinanceAnalyticsView({ finance, eventId, className }: FinanceAnalyticsViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'refunded'>('all');

  const filteredTransactions = finance.recentTransactions.filter((tx) => {
    const matchesSearch =
      tx.attendeeName.toLowerCase().includes(search.toLowerCase()) ||
      tx.attendeeEmail.toLowerCase().includes(search.toLowerCase()) ||
      tx.id.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const columns: Column<TransactionEntry>[] = [
    {
      key: 'id',
      header: 'Transaction ID',
      render: (tx) => <span className="font-mono text-[11px] text-muted-text">{tx.id}</span>,
    },
    {
      key: 'attendeeName',
      header: 'Attendee',
      render: (tx) => (
        <div>
          <div className="font-medium text-primary">{tx.attendeeName}</div>
          <div className="text-[10px] text-muted-text">{tx.attendeeEmail}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (tx) => (
        <span className="font-semibold text-primary">
          ${tx.amount.toLocaleString()} {tx.currency}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (tx) => (
        <StatusChip
          status={tx.status.toUpperCase()}
          variant={tx.status === 'completed' ? 'success' : 'danger'}
        />
      ),
    },
    {
      key: 'createdAt',
      header: 'Timestamp',
      align: 'right',
      render: (tx) => (
        <span className="text-[10px] text-muted-text">
          {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      ),
    },
  ];

  const handleExportCsv = () => {
    window.open(`/api/events/${eventId}/export`, '_blank');
  };

  return (
    <div className={clsx('space-y-6 font-mono', className)}>
      {/* Top Financial KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Gross Revenue"
          value={`$${finance.grossRevenue.toLocaleString()}`}
          sublabel={`${finance.paidTicketsCount} tickets sold @ $${finance.ticketPrice}`}
          variant="accent"
        />
        <MetricCard
          label="Projected Ceiling (100%)"
          value={`$${finance.projectedRevenue.toLocaleString()}`}
          sublabel="Total revenue potential at full capacity"
        />
        <MetricCard
          label="Avg Order Value"
          value={`$${finance.averageOrderValue.toLocaleString()}`}
          sublabel={`Standard ticket unit price`}
        />
        <MetricCard
          label="Revenue Realized"
          value={`${finance.occupancyFinancialRate}%`}
          sublabel="Capacity monetization velocity"
          variant={finance.occupancyFinancialRate >= 80 ? 'success' : 'neutral'}
        />
      </div>

      {/* Capacity & Revenue Progress Ledger */}
      <div className="border border-border-rigid p-6 bg-surface space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-rigid pb-4">
          <div>
            <h4 className="text-sm font-serif italic text-primary font-medium tracking-tight">
              Monetization Velocity
            </h4>
            <p className="text-[10px] text-muted-text uppercase tracking-widest mt-0.5">
              Gross Realized Revenue vs Capacity Ceiling
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-text uppercase">Unit Price:</span>
            <span className="font-bold text-primary">${finance.ticketPrice} {finance.currency}</span>
          </div>
        </div>

        <ProgressBar
          value={finance.occupancyFinancialRate}
          label="Financial Capacity Realized"
          sublabel={`$${finance.grossRevenue.toLocaleString()} / $${finance.projectedRevenue.toLocaleString()}`}
          variant={finance.occupancyFinancialRate >= 90 ? 'accent' : 'primary'}
          height="md"
        />
      </div>

      {/* Transaction Ledger Table Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-serif italic text-primary font-medium tracking-tight">
              Transaction Ledger
            </h4>
            <p className="text-[10px] text-muted-text uppercase tracking-widest mt-0.5">
              Itemized ticket sales & reservation audit trail
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex border border-border-rigid bg-surface-high text-[10px]">
              {(['all', 'completed', 'refunded'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={clsx(
                    'px-2.5 py-1 uppercase tracking-wider transition-colors',
                    statusFilter === st ? 'bg-primary text-surface font-semibold' : 'text-muted-text hover:text-primary'
                  )}
                >
                  {st}
                </button>
              ))}
            </div>

            <Button variant="secondary" size="sm" onClick={handleExportCsv}>
              📥 Export CSV
            </Button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Filter by attendee name, email, or TX ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 bg-surface border border-border-rigid px-3 text-xs font-mono text-primary placeholder:text-muted-text focus:outline-none focus:border-b-2 focus:border-primary rounded-none"
          />
        </div>

        <Table
          columns={columns}
          data={filteredTransactions}
          keyExtractor={(tx) => tx.id}
          emptyMessage="No transaction records match the filter."
        />
      </div>
    </div>
  );
}
