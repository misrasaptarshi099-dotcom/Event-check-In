'use client';

import React from 'react';
import { Table, type Column } from '../ui/Table';
import { StatusChip } from '../ui/StatusChip';
import type { CheckinSyncLog } from '@/types';

export interface SyncConflictDrawerProps {
  logs: CheckinSyncLog[];
  className?: string;
}

export function SyncConflictDrawer({ logs, className }: SyncConflictDrawerProps) {
  const columns: Column<CheckinSyncLog>[] = [
    {
      key: 'clientScanId',
      header: 'Scan ID (UUID)',
      render: (log) => <span className="font-mono text-[10px] text-muted-text">{log.clientScanId}</span>,
    },
    {
      key: 'stationId',
      header: 'Station',
      render: (log) => <span className="font-semibold text-primary">{log.stationId}</span>,
    },
    {
      key: 'source',
      header: 'Source',
      render: (log) => (
        <span className="text-[10px] uppercase font-mono text-muted-text">
          {log.source === 'offline_sync' ? '⚡ OFFLINE SYNC' : '🌐 REALTIME'}
        </span>
      ),
    },
    {
      key: 'result',
      header: 'Outcome',
      align: 'center',
      render: (log) => (
        <StatusChip
          status={log.result.toUpperCase()}
          variant={
            log.result === 'success'
              ? 'success'
              : log.result === 'duplicate_conflict'
              ? 'warning'
              : 'danger'
          }
        />
      ),
    },
    {
      key: 'syncedAt',
      header: 'Synced At',
      align: 'right',
      render: (log) => (
        <span className="text-[10px] text-muted-text font-mono">
          {new Date(log.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      ),
    },
  ];

  return (
    <div className={className}>
      <div className="space-y-3 font-mono">
        <div>
          <h4 className="text-base font-serif italic text-primary font-medium tracking-tight">
            Scanner Sync & Conflict Audit Log
          </h4>
          <p className="text-[10px] text-muted-text uppercase tracking-widest mt-0.5">
            Idempotent station check-in telemetry and multi-gate duplicate prevention records
          </p>
        </div>

        <Table
          columns={columns}
          data={logs}
          keyExtractor={(log) => log.id}
          emptyMessage="No scanner sync operations recorded yet. Multi-station check-ins will populate here."
        />
      </div>
    </div>
  );
}
