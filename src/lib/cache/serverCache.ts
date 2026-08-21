import type { EventItem } from '@/types';

interface ServerCacheEntry<T> {
  data: T;
  cachedAt: number;
  ttlMs: number;
}

const serverMemoryCache = new Map<string, ServerCacheEntry<unknown>>();

/**
 * Server-Side In-Memory Cache for Public Event Documents
 * Reduces Firestore reads on high-frequency read endpoints.
 */
export const serverCache = {
  get<T>(key: string): T | null {
    const entry = serverMemoryCache.get(key) as ServerCacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() - entry.cachedAt > entry.ttlMs) {
      serverMemoryCache.delete(key);
      return null;
    }

    return entry.data;
  },

  set<T>(key: string, data: T, ttlMs: number = 30_000): void {
    // Limit cache size to prevent memory leaks
    if (serverMemoryCache.size > 1000) {
      const oldestKey = serverMemoryCache.keys().next().value;
      if (oldestKey) serverMemoryCache.delete(oldestKey);
    }

    serverMemoryCache.set(key, {
      data,
      cachedAt: Date.now(),
      ttlMs,
    });
  },

  delete(key: string): void {
    serverMemoryCache.delete(key);
  },

  invalidateEvent(eventId: string): void {
    serverMemoryCache.delete(`event_${eventId}`);
    serverMemoryCache.delete('all_public_events');
  },

  getEvent(eventId: string): EventItem | null {
    return this.get<EventItem>(`event_${eventId}`);
  },

  setEvent(eventId: string, event: EventItem): void {
    this.set(`event_${eventId}`, event, 30_000); // 30s TTL
  },

  getPublicEvents(): EventItem[] | null {
    return this.get<EventItem[]>('all_public_events');
  },

  setPublicEvents(events: EventItem[]): void {
    this.set('all_public_events', events, 15_000); // 15s TTL
  },
};
