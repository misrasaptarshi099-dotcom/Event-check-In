'use client';

import React, { useRef } from 'react';
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
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    let targetIndex = -1;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      targetIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      targetIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      targetIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      targetIndex = tabs.length - 1;
    }

    if (targetIndex >= 0 && targetIndex < tabs.length) {
      onChange(tabs[targetIndex].id);
      tabRefs.current[targetIndex]?.focus();
    }
  };

  return (
    <div
      role="tablist"
      className={clsx(
        'flex items-center overflow-x-auto border-b border-border-rigid bg-surface scrollbar-none font-mono',
        className
      )}
    >
      {tabs.map((tab, idx) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[idx] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={clsx(
              'flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wider transition-all duration-150 relative whitespace-nowrap border-r border-border-rigid rounded-none focus:outline-none focus:ring-1 focus:ring-primary',
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
