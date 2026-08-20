import { adminDb } from '@/lib/firebase/admin';
import type { EventItem } from '@/types';

const EVENTS_COLLECTION = 'events';

/**
 * Creates a new event document in Firestore.
 * Omits description when not provided to avoid storing undefined in Firebase.
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

  // Only include description if provided (don't write undefined to Firebase)
  if (data.description !== undefined) {
    event.description = data.description;
  }

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
    .orderBy('createdAt', 'desc')
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
  updates: Partial<Pick<EventItem, 'name' | 'description' | 'eventDate' | 'capacity'>>
): Promise<void> {
  const eventRef = adminDb.collection(EVENTS_COLLECTION).doc(eventId);

  if (updates.capacity !== undefined) {
    // Transactional capacity update to maintain spotsRemaining consistency
    await adminDb.runTransaction(async (transaction) => {
      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists) {
        throw new Error(`Event ${eventId} not found.`);
      }

      const current = eventSnap.data() as EventItem;
      const capacityDelta = updates.capacity! - current.capacity;
      const newSpotsRemaining = Math.max(0, current.spotsRemaining + capacityDelta);

      transaction.update(eventRef, {
        ...updates,
        spotsRemaining: newSpotsRemaining,
      });
    });
  } else {
    // No capacity change — simple update
    await eventRef.update(updates);
  }
}

/**
 * Deletes an event document.
 */
export async function deleteEvent(eventId: string): Promise<void> {
  await adminDb.collection(EVENTS_COLLECTION).doc(eventId).delete();
}
