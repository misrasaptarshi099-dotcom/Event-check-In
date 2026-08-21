'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase/client';
import { Button, StatusChip } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const idToken = await user.getIdToken();
      const userEmail = user.email || '';

      // Verify authoritative role on backend
      const res = await fetch('/api/auth/check-role', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await res.json();
      const resolvedRole: 'organizer' | 'attendee' = data.role === 'organizer' ? 'organizer' : 'attendee';

      localStorage.setItem('vouch_user_role', resolvedRole);
      localStorage.setItem('vouch_user_uid', user.uid);
      localStorage.setItem('vouch_user_email', userEmail);
      localStorage.setItem('vouch_user_name', user.displayName || '');
      localStorage.setItem('vouch_auth_token', idToken);

      if (resolvedRole === 'organizer') {
        router.push('/organizer');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled. Please complete the Google authorization window.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Google sign-in popup was blocked by browser. Please allow popups for this site.');
      } else {
        setError(err.message || 'Google authentication failed.');
      }
    } finally {
      setLoading(false);
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
        <StatusChip status="SECURE AUTHENTICATION" variant="neutral" />
      </header>

      {/* Main Form Container */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md border-2 border-border-rigid bg-surface shadow-xl p-8 space-y-6">
          <div className="space-y-1 border-b border-border-rigid pb-4">
            <h1 className="text-2xl font-serif italic text-primary font-medium tracking-tight">
              Sign In to VOUCH
            </h1>
            <p className="text-[11px] text-muted-text uppercase tracking-wider">
              Single Sign-On with Google OAuth
            </p>
          </div>

          {error && (
            <div className="border border-accent bg-accent/10 p-3 text-xs text-accent">
              [!] {error}
            </div>
          )}

          {/* Google OAuth Button */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-14 border-2 border-border-rigid bg-surface hover:bg-surface-high transition-colors flex items-center justify-center gap-3 font-mono text-xs uppercase font-bold tracking-wider text-primary shadow-sm hover:shadow active:bg-primary active:text-surface disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {/* Google G SVG */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>{loading ? 'Authenticating...' : 'Continue with Google'}</span>
            </button>
          </div>

          {/* Access Tier Explanation */}
          <div className="border border-border-rigid p-4 bg-surface-low text-[11px] text-muted-text space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-primary">
              <span>🔒</span>
              <span className="uppercase">Role Governance:</span>
            </div>
            <ul className="space-y-1 text-[10px] list-disc list-inside">
              <li>
                <strong className="text-primary">Attendees:</strong> Instant registration, ticketing pass issuance, and check-in history.
              </li>
              <li>
                <strong className="text-primary">Organizers:</strong> Strictly restricted to approved administrators (e.g. <span className="font-mono text-accent">misrsaptarshi099@gmail.com</span> or team members invited by an existing organizer).
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
