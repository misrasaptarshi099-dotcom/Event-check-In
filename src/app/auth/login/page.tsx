'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input, StatusChip } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<'organizer' | 'attendee'>('organizer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Set local authentication state
      const mockUid = role === 'organizer' ? 'org_demo_admin' : 'att_demo_user';
      localStorage.setItem('vouch_user_role', role);
      localStorage.setItem('vouch_user_uid', mockUid);
      localStorage.setItem('vouch_user_email', email || `${role}@vouch.event`);
      localStorage.setItem('vouch_auth_token', `demo-${role}-token-${Date.now()}`);

      if (role === 'organizer') {
        router.push('/organizer');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (selectedRole: 'organizer' | 'attendee') => {
    const mockUid = selectedRole === 'organizer' ? 'org_demo_admin' : 'att_demo_user';
    localStorage.setItem('vouch_user_role', selectedRole);
    localStorage.setItem('vouch_user_uid', mockUid);
    localStorage.setItem('vouch_user_email', `${selectedRole}@vouch.event`);
    localStorage.setItem('vouch_auth_token', `demo-${selectedRole}-token`);

    if (selectedRole === 'organizer') {
      router.push('/organizer');
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-mono bg-surface text-primary">
      {/* Top Header */}
      <header className="border-b border-border-rigid px-6 md:px-12 flex items-center justify-between h-16 bg-surface">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-sm font-mono font-bold tracking-[0.25em] text-primary">
            VOUCH
          </span>
          <span className="text-[10px] font-mono text-muted-text">/</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-text">
            Access Control
          </span>
        </Link>
        <StatusChip status="AUTHENTICATION PORTAL" variant="neutral" />
      </header>

      {/* Main Form Container */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md border-2 border-border-rigid bg-surface shadow-xl p-8 space-y-6">
          <div className="space-y-1 border-b border-border-rigid pb-4">
            <h1 className="text-2xl font-serif italic text-primary font-medium tracking-tight">
              Sign In to VOUCH
            </h1>
            <p className="text-[11px] text-muted-text uppercase tracking-wider">
              Select access tier and authenticate credentials
            </p>
          </div>

          {/* Role Toggle Switch */}
          <div className="grid grid-cols-2 border border-border-rigid bg-surface-high">
            <button
              type="button"
              onClick={() => setRole('organizer')}
              className={`py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                role === 'organizer'
                  ? 'bg-primary text-surface'
                  : 'text-muted-text hover:text-primary'
              }`}
            >
              Organizer Hub
            </button>
            <button
              type="button"
              onClick={() => setRole('attendee')}
              className={`py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                role === 'attendee'
                  ? 'bg-primary text-surface'
                  : 'text-muted-text hover:text-primary'
              }`}
            >
              Attendee Pass
            </button>
          </div>

          {error && (
            <div className="border border-accent bg-accent/10 p-3 text-xs text-accent">
              [!] {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder={role === 'organizer' ? 'organizer@vouch.event' : 'attendee@gmail.com'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Passcode / Password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full"
            >
              Authenticate & Enter
            </Button>
          </form>

          {/* Quick Demo Fill Buttons */}
          <div className="border-t border-border-rigid pt-4 space-y-2 text-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-text">
              Rapid Demo Access:
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="flex-1 text-[11px]"
                onClick={() => handleQuickDemo('organizer')}
              >
                Demo Organizer
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="flex-1 text-[11px]"
                onClick={() => handleQuickDemo('attendee')}
              >
                Demo Attendee
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
