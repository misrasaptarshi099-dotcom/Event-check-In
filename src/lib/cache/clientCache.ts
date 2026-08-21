import type { EventItem, Registration } from '@/types';

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttlMs: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

/**
 * Client-Side Cache for Non-Sensitive Presentation Data
 * Uses in-memory Map with sessionStorage persistence where available.
 */
export const clientCache = {
  get<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;

    // 1. Check memory cache first
    const mem = memoryCache.get(key) as CacheEntry<T> | undefined;
    if (mem && Date.now() - mem.cachedAt < mem.ttlMs) {
      return mem.data;
    }

    // 2. Check sessionStorage
    try {
      const raw = window.sessionStorage.getItem(`vouch_cache_${key}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CacheEntry<T>;
      if (Date.now() - parsed.cachedAt < parsed.ttlMs) {
        memoryCache.set(key, parsed);
        return parsed.data;
      }
      window.sessionStorage.removeItem(`vouch_cache_${key}`);
    } catch {
      // Ignore storage errors (private browsing or quota exceeded)
    }

    return null;
  },

  set<T>(key: string, data: T, ttlMs: number = 60_000): void {
    if (typeof window === 'undefined') return;

    const entry: CacheEntry<T> = {
      data,
      cachedAt: Date.now(),
      ttlMs,
    };

    memoryCache.set(key, entry as CacheEntry<unknown>);

    try {
      window.sessionStorage.setItem(`vouch_cache_${key}`, JSON.stringify(entry));
    } catch {
      // Ignore quota errors
    }
  },

  remove(key: string): void {
    memoryCache.delete(key);
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(`vouch_cache_${key}`);
      } catch {
        // Ignore
      }
    }
  },

  // Helper for caching public events catalog
  getPublicEvents(): EventItem[] | null {
    return this.get<EventItem[]>('public_events_feed');
  },

  setPublicEvents(events: EventItem[]): void {
    this.set('public_events_feed', events, 30_000); // 30s TTL
  },

  // Helper for caching single event metadata
  getEvent(eventId: string): EventItem | null {
    return this.get<EventItem>(`event_${eventId}`);
  },

  setEvent(eventId: string, event: EventItem): void {
    this.set(`event_${eventId}`, event, 60_000); // 1 min TTL
  },

  // Helper for caching attendee ticket presentation (0ms instant render)
  getPassBundle(idOrPassCode: string): { registration: Registration; event: EventItem } | null {
    return this.get<{ registration: Registration; event: EventItem }>(`pass_${idOrPassCode}`);
  },

  setPassBundle(idOrPassCode: string, bundle: { registration: Registration; event: EventItem }): void {
    this.set(`pass_${idOrPassCode}`, bundle, 120_000); // 2 min TTL
    if (bundle.registration.passCode) {
      this.set(`pass_${bundle.registration.passCode}`, bundle, 120_000);
    }
    if (bundle.registration.id) {
      this.set(`pass_${bundle.registration.id}`, bundle, 120_000);
    }
  },
};
