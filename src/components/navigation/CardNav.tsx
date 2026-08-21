'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Button } from '../ui/Button';

export interface CardNavItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  href?: string;
  onClick?: () => void;
  badge?: string;
  variant?: 'primary' | 'accent' | 'default';
  isOrganizerOnly?: boolean;
}

export interface CardNavProps {
  currentSection?: string;
  role?: string | null;
  userEmail?: string | null;
  passesCount?: number;
  organizersCount?: number;
  onOpenTeamModal?: () => void;
  onLogout?: () => void;
  className?: string;
}

export function CardNav({
  currentSection = 'Event Check-In OS',
  role,
  userEmail,
  passesCount = 0,
  organizersCount = 0,
  onOpenTeamModal,
  onLogout,
  className,
}: CardNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const isOrganizer = role === 'organizer';

  const navCards: CardNavItem[] = [
    ...(isOrganizer
      ? [
          {
            id: 'organizer_hub',
            title: 'Organizer Hub',
            subtitle: 'Real-time metrics, capacity & financial analytics',
            icon: '📊',
            href: '/organizer',
            badge: 'Operations',
            variant: 'default' as const,
          },
          {
            id: 'create_event',
            title: 'Create Event Studio',
            subtitle: 'Publish new events with dynamic ticketing & posters',
            icon: '✨',
            href: '/organizer/create',
            badge: '+ New',
            variant: 'accent' as const,
          },
          {
            id: 'scanner',
            title: 'Fast Gate Scanner',
            subtitle: 'Camera viewfinder with offline queue sync',
            icon: '📷',
            href: '/scanner',
            badge: 'Gate Scanner',
            variant: 'primary' as const,
          },
          ...(onOpenTeamModal
            ? [
                {
                  id: 'team_access',
                  title: 'Team Access',
                  subtitle: 'Manage authorized organizers & gate staff',
                  icon: '👥',
                  onClick: () => {
                    setIsOpen(false);
                    onOpenTeamModal();
                  },
                  badge: organizersCount > 0 ? `${organizersCount} Staff` : 'Manage',
                  variant: 'default' as const,
                },
              ]
            : []),
        ]
      : []),
    {
      id: 'my_passes',
      title: 'My Passes & Tickets',
      subtitle: 'Access dynamic rotating TOTP admission tokens',
      icon: '🎟️',
      href: '/#my-passes',
      badge: passesCount > 0 ? `${passesCount} Active` : undefined,
      variant: 'accent' as const,
    },
    {
      id: 'events_ledger',
      title: 'Public Events Ledger',
      subtitle: 'Browse and register for live scheduled events',
      icon: '🏛️',
      href: '/#events-ledger',
      variant: 'default' as const,
    },
  ];

  return (
    <>
      {/* Top Header Bar */}
      <header
        className={clsx(
          'border-b border-border-rigid px-4 sm:px-6 md:px-12 flex items-center justify-between h-16 bg-surface relative z-30 font-mono select-none',
          className
        )}
      >
        {/* Brand / Context Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0 group">
            <span className="text-sm font-mono font-bold tracking-[0.25em] text-primary group-hover:text-accent transition-colors">
              VOUCH
            </span>
            <span className="text-[10px] font-mono text-muted-text">/</span>
          </Link>
          <span className="text-[10px] sm:text-xs uppercase tracking-widest text-primary font-semibold truncate">
            {currentSection}
          </span>
        </div>

        {/* Desktop Navigation Row (Hidden on Mobile) */}
        <div className="hidden md:flex items-center gap-3">
          {passesCount > 0 && (
            <a href="/#my-passes">
              <Button variant="accent" size="sm" className="text-xs">
                🎟️ My Passes ({passesCount})
              </Button>
            </a>
          )}

          {isOrganizer && (
            <>
              {onOpenTeamModal && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenTeamModal}
                  title="Manage Authorized Organizers"
                >
                  👥 Team Access
                </Button>
              )}
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
              <Link href="/organizer">
                <Button variant="secondary" size="sm">
                  Organizer Hub
                </Button>
              </Link>
            </>
          )}

          {userEmail && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 border border-border-rigid bg-surface-high text-[10px]">
              <span className={clsx("w-1.5 h-1.5 rounded-full", isOrganizer ? "bg-accent" : "bg-[#15803D]")} />
              <span className="font-semibold uppercase">{role || 'ATTENDEE'}:</span>
              <span className="text-muted-text truncate max-w-[150px]">{userEmail}</span>
            </div>
          )}

          {userEmail ? (
            <Button variant="ghost" size="sm" onClick={onLogout}>
              Logout
            </Button>
          ) : (
            <Link href="/auth/login">
              <Button variant="primary" size="sm">
                Login / Sign In
              </Button>
            </Link>
          )}
        </div>

        {/* Mobile Navigation Trigger (Card Nav Button from React Bits style) */}
        <div className="flex md:hidden items-center gap-2">
          {passesCount > 0 && (
            <a href="/#my-passes" onClick={() => setIsOpen(false)}>
              <span className="px-2 py-1 bg-accent text-surface text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <span>🎟️</span> {passesCount}
              </span>
            </a>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Close navigation menu' : 'Open card navigation menu'}
            className={clsx(
              'h-9 px-3 border-2 border-border-rigid flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all duration-150 active:scale-95 cursor-pointer',
              isOpen
                ? 'bg-primary text-surface border-primary'
                : 'bg-surface hover:bg-surface-high text-primary'
            )}
          >
            <span>{isOpen ? '✕' : '☰'}</span>
            <span>{isOpen ? 'CLOSE' : 'MENU'}</span>
          </button>
        </div>
      </header>

      {/* React Bits Card Navigation Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 top-16 bg-primary/80 backdrop-blur-md z-40 flex flex-col justify-between p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150 font-mono"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-lg mx-auto space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Badge */}
            <div className="flex items-center justify-between border-b border-border-rigid/40 pb-2 text-surface text-[10px] uppercase tracking-widest">
              <span>NAVIGATION MATRIX</span>
              <span>{role ? `ROLE: ${role.toUpperCase()}` : 'GUEST ACCESS'}</span>
            </div>

            {/* Grid of Interactive Nav Cards */}
            <div className="grid grid-cols-1 gap-2.5">
              {navCards.map((card) => {
                const CardContent = (
                  <div
                    className={clsx(
                      'border-2 p-3.5 transition-all duration-150 flex items-start gap-3 group relative cursor-pointer active:scale-[0.98]',
                      card.variant === 'accent'
                        ? 'bg-surface border-accent hover:border-accent-hover text-primary shadow-md'
                        : card.variant === 'primary'
                        ? 'bg-surface border-primary hover:bg-surface-high text-primary'
                        : 'bg-surface border-border-rigid hover:bg-surface-high text-primary'
                    )}
                  >
                    <div className="w-10 h-10 border border-border-rigid bg-surface-low flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-105 transition-transform">
                      {card.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary group-hover:text-accent transition-colors truncate">
                          {card.title}
                        </span>
                        {card.badge && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-surface-high border border-border-rigid text-primary flex-shrink-0">
                            {card.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-text mt-0.5 line-clamp-1">
                        {card.subtitle}
                      </p>
                    </div>

                    <div className="text-muted-text group-hover:text-primary transition-colors text-xs self-center">
                      →
                    </div>
                  </div>
                );

                if (card.href) {
                  return (
                    <Link
                      key={card.id}
                      href={card.href}
                      onClick={() => setIsOpen(false)}
                      className="block"
                    >
                      {CardContent}
                    </Link>
                  );
                }

                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={card.onClick}
                    className="w-full text-left"
                  >
                    {CardContent}
                  </button>
                );
              })}
            </div>

            {/* User Profile & Session Footer Card */}
            <div className="border-2 border-border-rigid bg-surface p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between text-xs">
                <div className="space-y-0.5 min-w-0 pr-2">
                  <span className="text-[9px] uppercase tracking-widest text-muted-text block">
                    CURRENT SESSION
                  </span>
                  <p className="font-bold text-primary truncate text-xs">
                    {userEmail || 'Guest Attendee'}
                  </p>
                  <p className="text-[10px] text-muted-text">
                    Status: <span className="font-semibold text-primary">{role ? role.toUpperCase() : 'NOT SIGNED IN'}</span>
                  </p>
                </div>

                <div className="flex-shrink-0">
                  <span className={clsx("inline-block w-3 h-3 rounded-full border border-border-rigid", isOrganizer ? "bg-accent" : userEmail ? "bg-[#15803D]" : "bg-muted-text")} />
                </div>
              </div>

              <div className="pt-2 border-t border-border-rigid flex items-center gap-2">
                {userEmail ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs font-bold uppercase tracking-wider text-accent border-accent/40 hover:bg-accent hover:text-surface"
                    onClick={() => {
                      setIsOpen(false);
                      onLogout?.();
                    }}
                  >
                    🚪 Logout & Lock Session
                  </Button>
                ) : (
                  <Link href="/auth/login" className="w-full" onClick={() => setIsOpen(false)}>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      className="w-full text-xs font-bold uppercase tracking-wider"
                    >
                      🔑 Sign In with Google
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
