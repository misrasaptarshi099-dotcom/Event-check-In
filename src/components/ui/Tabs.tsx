'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={clsx(
        'flex items-center overflow-x-auto border-b border-border-rigid bg-surface scrollbar-none font-mono',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wider transition-all duration-150 relative whitespace-nowrap border-r border-border-rigid rounded-none',
              isActive
                ? 'bg-primary text-surface font-semibold'
                : 'text-muted-text hover:text-primary hover:bg-surface-high'
            )}
          >
            {tab.icon && <span className="opacity-80">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={clsx(
                  'text-[10px] px-1.5 py-0.5 border font-mono tracking-tight',
                  isActive
                    ? 'border-surface/40 bg-surface/20 text-surface'
                    : 'border-border-rigid bg-surface-high text-primary'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
