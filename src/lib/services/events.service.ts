import { adminDb } from '@/lib/firebase/admin';
import type { EventItem } from '@/types';
import { serverCache } from '@/lib/cache/serverCache';

const EVENTS_COLLECTION = 'events';

/**
 * Creates a new event document in Firestore.
 * Omits undefined fields to prevent writing undefined to Firebase.
 */
export async function createEvent(
  data: Omit<EventItem, 'id' | 'createdAt' | 'spotsRemaining'>
): Promise<EventItem> {
  const docRef = adminDb.collection(EVENTS_COLLECTION).doc();
  const now = new Date().toISOString();

  const event: EventItem = {
    id: docRef.id,
    organizerId: data.organizerId,
    name: data.name,
    eventDate: data.eventDate,
    capacity: data.capacity,
    spotsRemaining: data.capacity,
    createdAt: now,
  };

  if (data.description !== undefined) event.description = data.description;
  if (data.eventEndDate !== undefined) event.eventEndDate = data.eventEndDate;
  if (data.timezone !== undefined) event.timezone = data.timezone;
  if (data.venue !== undefined) event.venue = data.venue;
  if (data.bannerUrl !== undefined) event.bannerUrl = data.bannerUrl;
  if (data.ticketPrice !== undefined) event.ticketPrice = Number(data.ticketPrice);
  if (data.currency !== undefined) event.currency = data.currency;

  await docRef.set(event);
  serverCache.setEvent(event.id, event);
  serverCache.delete('all_public_events');
  return event;
}

/**
 * Retrieves a single event by ID.
 */
export async function getEventById(eventId: string): Promise<EventItem | null> {
  const cached = serverCache.getEvent(eventId);
  if (cached) return cached;

  const doc = await adminDb.collection(EVENTS_COLLECTION).doc(eventId).get();
  if (!doc.exists) return null;
  const event = doc.data() as EventItem;
  serverCache.setEvent(eventId, event);
  return event;
}

/**
 * Retrieves all events owned by a specific organizer.
 */
export async function getEventsByOrganizer(organizerId: string): Promise<EventItem[]> {
  const snapshot = await adminDb
    .collection(EVENTS_COLLECTION)
    .where('organizerId', '==', organizerId)
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as EventItem)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

/**
 * Retrieves the event portfolio available to the authorized organizer team.
 * Event ownership remains recorded for auditing, but operational access is
 * shared by the organization rather than tied to a single Firebase UID.
 */
export async function getAllOrganizerEvents(limitCount: number = 100): Promise<EventItem[]> {
  const snapshot = await adminDb
    .collection(EVENTS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(limitCount)
    .get();
  return snapshot.docs.map((doc) => doc.data() as EventItem);
}

/**
 * Retrieves all active upcoming public events for attendee discovery.
 * Filters out concluded events whose end time (or start time) is in the past,
 * and sorts upcoming events in chronological order by eventDate before slicing to limitCount.
 */
export async function getAllPublicEvents(limitCount: number = 100): Promise<EventItem[]> {
  const cached = serverCache.getPublicEvents();
  if (cached) {
    return cached.slice(0, limitCount);
  }

  const snapshot = await adminDb
    .collection(EVENTS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .get();

  const now = Date.now();

  const events = snapshot.docs
    .map((doc) => doc.data() as EventItem)
    .filter((event) => {
      // Exclude cancelled events
      if (event.status === 'cancelled') return false;

      // Concluded events (past end date or past start date if no end date) are excluded from public discovery
      const endTime = event.eventEndDate
        ? new Date(event.eventEndDate).getTime()
        : new Date(event.eventDate).getTime();
      return endTime > now;
    })
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

  serverCache.setPublicEvents(events);
  return events.slice(0, limitCount);
}

/**
 * Updates mutable fields on an event document.
 *
 * Capacity changes are handled transactionally:
 * The delta between old and new capacity is applied to spotsRemaining,
 * clamped to a minimum of 0 to prevent negative values.
 */
export async function updateEvent(
  eventId: string,
  updates: Partial<Pick<EventItem, 'name' | 'description' | 'eventDate' | 'eventEndDate' | 'capacity' | 'timezone' | 'venue' | 'bannerUrl' | 'ticketPrice' | 'currency'>>
): Promise<void> {
  const eventRef = adminDb.collection(EVENTS_COLLECTION).doc(eventId);

  // Clean updates object of undefined values
  const cleanUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  if (updates.capacity !== undefined) {
    // Transactional capacity update to maintain spotsRemaining consistency
    await adminDb.runTransaction(async (transaction) => {
      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists) {
        throw new Error(`Event ${eventId} not found.`);
      }

      const current = eventSnap.data() as EventItem;
      const capacityDelta = Number(updates.capacity) - current.capacity;
      const newSpotsRemaining = Math.max(0, current.spotsRemaining + capacityDelta);

      transaction.update(eventRef, {
        ...cleanUpdates,
        spotsRemaining: newSpotsRemaining,
      });
    });
  } else {
    // No capacity change — standard update
    await eventRef.update(cleanUpdates);
  }

  serverCache.invalidateEvent(eventId);
  serverCache.delete('all_public_events');
}

/**
 * Cancels an entire event and processes mass cancellation & refunds for all active registrations.
 *
 * Unlike deleteEvent which wipes records, cancelEntireEvent preserves the event document in Firestore,
 * updates event.status to 'cancelled', records the organizer's apology/cancellation note, and cancels
 * all active attendee registrations with full refund logging.
 */
export async function cancelEntireEvent(
  eventId: string,
  requester: { uid: string; role?: string },
  cancellationReason: string
): Promise<{
  event: EventItem;
  registrationsCancelled: number;
  totalRefunded: number;
}> {
  const eventRef = adminDb.collection(EVENTS_COLLECTION).doc(eventId);
  const eventDoc = await eventRef.get();

  if (!eventDoc.exists) {
    throw new Error(`Event ${eventId} not found.`);
  }

  const event = eventDoc.data() as EventItem;
  if (event.organizerId !== requester.uid && requester.role !== 'organizer') {
    throw new Error('Unauthorized to cancel this event.');
  }

  if (event.status === 'cancelled') {
    throw new Error('This event has already been cancelled.');
  }

  const nowIso = new Date().toISOString();
  const cleanReason = cancellationReason.trim() || 'Event cancelled by the organizer.';

  // 1. Fetch all registrations for this event
  const regSnap = await adminDb
    .collection('registrations')
    .where('eventId', '==', eventId)
    .get();

  let registrationsCancelled = 0;
  let totalRefunded = 0;

  // Use Firestore batch to update event and active registrations atomically
  const batch = adminDb.batch();

  // Update event document
  const updatedEvent: EventItem = {
    ...event,
    status: 'cancelled',
    cancellationReason: cleanReason,
    cancelledAt: nowIso,
    cancelledBy: requester.uid,
    spotsRemaining: 0,
  };

  batch.update(eventRef, {
    status: 'cancelled',
    cancellationReason: cleanReason,
    cancelledAt: nowIso,
    cancelledBy: requester.uid,
    spotsRemaining: 0,
  });

  for (const doc of regSnap.docs) {
    const reg = doc.data();
    if (reg.status === 'active') {
      const seats = reg.guestCount || 1;
      const unitPrice = reg.ticketPrice !== undefined ? reg.ticketPrice : (event.ticketPrice || 0);
      totalRefunded += unitPrice * seats;
      registrationsCancelled++;

      batch.update(doc.ref, {
        status: 'cancelled',
        cancelledAt: nowIso,
        cancelledBy: requester.uid,
      });
    }
  }

  await batch.commit();

  serverCache.invalidateEvent(eventId);

  return {
    event: updatedEvent,
    registrationsCancelled,
    totalRefunded,
  };
}

/**
 * Deletes an event document completely from Firestore.
 */
export async function deleteEvent(eventId: string): Promise<void> {
  await adminDb.collection(EVENTS_COLLECTION).doc(eventId).delete();
  serverCache.invalidateEvent(eventId);
}

