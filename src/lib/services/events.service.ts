import { adminDb } from '@/lib/firebase/admin';
import type { EventItem } from '@/types';

const EVENTS_COLLECTION = 'events';

/**
 * Creates a new event document in Firestore.
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
    description: data.description,
    eventDate: data.eventDate,
    capacity: data.capacity,
    spotsRemaining: data.capacity,
    createdAt: now,
  };

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
 */
export async function updateEvent(
  eventId: string,
  updates: Partial<Pick<EventItem, 'name' | 'description' | 'eventDate' | 'capacity'>>
): Promise<void> {
  await adminDb.collection(EVENTS_COLLECTION).doc(eventId).update(updates);
}

/**
 * Deletes an event document.
 */
export async function deleteEvent(eventId: string): Promise<void> {
  await adminDb.collection(EVENTS_COLLECTION).doc(eventId).delete();
}
