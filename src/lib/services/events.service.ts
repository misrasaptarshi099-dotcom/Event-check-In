import { adminDb } from '@/lib/firebase/admin';
import type { EventItem } from '@/types';

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
  return event;
}

/**
 * Retrieves a single event by ID.
 */
export async function getEventById(eventId: string): Promise<EventItem | null> {
  const doc = await adminDb.collection(EVENTS_COLLECTION).doc(eventId).get();
  if (!doc.exists) return null;
  return doc.data() as EventItem;
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
 * Retrieves all active upcoming public events for attendee discovery.
 */
export async function getAllPublicEvents(): Promise<EventItem[]> {
  const snapshot = await adminDb
    .collection(EVENTS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  return snapshot.docs.map((doc) => doc.data() as EventItem);
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
}

/**
 * Deletes an event document.
 */
export async function deleteEvent(eventId: string): Promise<void> {
  await adminDb.collection(EVENTS_COLLECTION).doc(eventId).delete();
}
