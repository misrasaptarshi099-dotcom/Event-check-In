/**
 * Sliding-Window Rate Limiter for Serverless API Routes
 *
 * In-memory implementation suitable for single-instance Vercel serverless functions.
 * For multi-instance production, replace the store with Upstash Redis or Vercel KV.
 *
 * Implements per-key sliding window with configurable max requests and window duration.
 * Returns standard 429 Too Many Requests with Retry-After header when exceeded.
 */

import { NextResponse } from 'next/server';

export interface RateLimitConfig {
  /** Maximum requests allowed within the window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Identifier prefix for the rate limit bucket (e.g., 'ai-insights', 'register') */
  prefix: string;
}

interface RateLimitEntry {
  timestamps: number[];
}

// In-memory store (per serverless instance)
const store = new Map<string, RateLimitEntry>();

// Periodic cleanup to prevent memory leaks
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

/**
 * Checks the rate limit for a given key.
 *
 * @returns `null` if within limits, or a `NextResponse` with 429 if exceeded.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): NextResponse | null {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const bucketKey = `${config.prefix}:${key}`;

  cleanup(windowMs);

  let entry = store.get(bucketKey);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(bucketKey, entry);
  }

  // Slide window: remove timestamps older than the window
  const cutoff = now - windowMs;
  entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterSeconds = Math.ceil((oldestInWindow + windowMs - now) / 1000);

    return NextResponse.json(
      {
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Max ${config.maxRequests} requests per ${config.windowSeconds}s.`,
        retryAfter: retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
          'X-RateLimit-Limit': String(config.maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil((oldestInWindow + windowMs) / 1000)),
        },
      }
    );
  }

  // Allow the request
  entry.timestamps.push(now);
  return null;
}

/**
 * Extracts a rate-limit key from the request.
 * Uses the user UID if available, otherwise falls back to IP.
 */
export function getRateLimitKey(request: Request, userId?: string): string {
  if (userId) return userId;

  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  return ip;
}

// ─── Pre-configured Rate Limit Presets ──────────────────────────────

/** AI Insights: 5 req/min per organizer */
export const AI_INSIGHTS_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowSeconds: 60,
  prefix: 'ai-insights',
};

/** Registration: 10 req/min per IP */
export const REGISTRATION_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowSeconds: 60,
  prefix: 'register',
};

/** Check-in Scan: 60 req/min per station */
export const CHECKIN_SCAN_LIMIT: RateLimitConfig = {
  maxRequests: 60,
  windowSeconds: 60,
  prefix: 'checkin-scan',
};

/** Data Export: 10 req/min per organizer */
export const EXPORT_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowSeconds: 60,
  prefix: 'export',
};

/** Auth Brute-Force: 5 attempts/5 min */
export const AUTH_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowSeconds: 300,
  prefix: 'auth',
};
