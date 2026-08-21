import { adminDb } from '@/lib/firebase/admin';
import { generateTotpSecret } from '@/lib/security/totp';
import type { Registration, EventItem } from '@/types';

const EVENTS_COLLECTION = 'events';
const REGISTRATIONS_COLLECTION = 'registrations';

export class RegistrationError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'RegistrationError';
    this.statusCode = statusCode;
  }
}

/**
 * Atomic Registration with Capacity Enforcement (HR-1)
 *
 * Executes a Firestore runTransaction to:
 * 1. Read the event document.
 * 2. Validate spots_remaining >= guestCount.
 * 3. Atomically decrement spots_remaining by guestCount.
 * 4. Write the new registration with a generated TOTP secret, guestCount, and event ticket price.
 *
 * If capacity is exhausted, aborts with 409 "Event is Full".
 * If the attendee is already registered, aborts with 409 "Already Registered".
 */
export async function registerForEvent(
  eventId: string,
  attendeeId: string,
  attendeeName: string,
  attendeeEmail: string,
  guestCount: number = 1
): Promise<Registration> {
  const eventRef = adminDb.collection(EVENTS_COLLECTION).doc(eventId);
  const regId = `${eventId}_${attendeeId}`;
  const regRef = adminDb.collection(REGISTRATIONS_COLLECTION).doc(regId);

  return adminDb.runTransaction(async (transaction) => {
    // 1. Read event document
    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists) {
      throw new RegistrationError(404, 'Event not found.');
    }

    const event = eventSnap.data() as EventItem;

    // 2. Validate event lifecycle: Registration closes once event starts
    const nowMs = Date.now();
    const eventStartMs = new Date(event.eventDate).getTime();
    if (nowMs >= eventStartMs) {
      throw new RegistrationError(400, 'Registration is closed. This event has already started.');
    }
    if (event.eventEndDate && nowMs >= new Date(event.eventEndDate).getTime()) {
      throw new RegistrationError(400, 'Registration is closed. This event has already ended.');
    }

    // 3. Check for duplicate registration
    const existingReg = await transaction.get(regRef);
    if (existingReg.exists) {
      throw new RegistrationError(409, 'You are already registered for this event.');
    }

    // 4. Validate capacity against guest count
    if (event.spotsRemaining <= 0) {
      throw new RegistrationError(409, 'Event is full. No spots remaining.');
    }
    if (event.spotsRemaining < guestCount) {
      throw new RegistrationError(409, `Only ${event.spotsRemaining} spot(s) remaining. Cannot reserve ${guestCount} seats.`);
    }

    // 4. Atomically decrement spots_remaining by guestCount
    transaction.update(eventRef, {
      spotsRemaining: event.spotsRemaining - guestCount,
    });

    // 5. Generate TOTP secret and create registration record
    const totpSecret = generateTotpSecret();
    const now = new Date().toISOString();

    const registration: Registration = {
      id: regId,
      eventId,
      attendeeId,
      attendeeName,
      attendeeEmail,
      qrToken: regId,
      totpSecret,
      status: 'active',
      guestCount,
      ticketPrice: event.ticketPrice ?? 0,
      createdAt: now,
    };

    transaction.set(regRef, registration);

    return registration;
  });
}

/**
 * Retrieves a registration by ID.
 */
export async function getRegistrationById(regId: string): Promise<Registration | null> {
  const doc = await adminDb.collection(REGISTRATIONS_COLLECTION).doc(regId).get();
  if (!doc.exists) return null;
  return doc.data() as Registration;
}

export interface PaginatedRosterResult {
  roster: Registration[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount: number;
  pageSize: number;
}

/**
 * Retrieves paginated registrations for an event with cursor, search, and status filtering.
 */
export async function getPaginatedRegistrationsByEvent(
  eventId: string,
  options?: {
    pageSize?: number;
    cursor?: string;
    search?: string;
    status?: string;
  }
): Promise<PaginatedRosterResult> {
  const pageSize = Math.max(1, Math.min(Number(options?.pageSize) || 50, 200));
  const cursor = options?.cursor?.trim();
  const search = options?.search?.trim().toLowerCase();
  const statusFilter = options?.status?.trim().toLowerCase();

  const [snapshot, checkinsSnap] = await Promise.all([
    adminDb
      .collection(REGISTRATIONS_COLLECTION)
      .where('eventId', '==', eventId)
      .get(),
    adminDb
      .collection('events')
      .doc(eventId)
      .collection('checkins')
      .get(),
  ]);

  const checkinsMap = new Map<string, { checkedInAt: string }>();
  for (const doc of checkinsSnap.docs) {
    const data = doc.data();
    checkinsMap.set(data.registrationId || doc.id, {
      checkedInAt: data.checkedInAt || data.createdAt,
    });
  }

  let allRegistrations: Registration[] = snapshot.docs
    .map((doc) => {
      const reg = doc.data() as Registration;
      const checkin = checkinsMap.get(reg.id);
      return {
        ...reg,
        totpSecret: '', // Sanitized: secret is not exposed in public/organizer roster payload
        checkedIn: !!checkin,
        checkedInAt: checkin?.checkedInAt,
      };
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  // Apply status filter
  if (statusFilter && statusFilter !== 'all') {
    allRegistrations = allRegistrations.filter((r) => {
      if (statusFilter === 'active' || statusFilter === 'confirmed') {
        return r.status === 'active' && !r.checkedIn;
      }
      if (statusFilter === 'checked_in' || statusFilter === 'attended') {
        return r.checkedIn;
      }
      if (statusFilter === 'cancelled') {
        return r.status === 'cancelled';
      }
      return true;
    });
  }

  // Apply search query
  if (search) {
    allRegistrations = allRegistrations.filter(
      (r) =>
        r.attendeeName.toLowerCase().includes(search) ||
        r.attendeeEmail.toLowerCase().includes(search) ||
        r.id.toLowerCase().includes(search)
    );
  }

  const totalCount = allRegistrations.length;

  let startIndex = 0;
  if (cursor) {
    const cursorIdx = allRegistrations.findIndex((r) => r.id === cursor);
    if (cursorIdx !== -1) {
      startIndex = cursorIdx + 1;
    }
  }

  const pageSlice = allRegistrations.slice(startIndex, startIndex + pageSize);
  const hasMore = startIndex + pageSize < totalCount;
  const nextCursor = hasMore && pageSlice.length > 0 ? pageSlice[pageSlice.length - 1].id : undefined;

  return {
    roster: pageSlice,
    nextCursor,
    hasMore,
    totalCount,
    pageSize,
  };
}

/**
 * Retrieves all registrations for an event, joining check-in status for each attendee.
 */
export async function getRegistrationsByEvent(eventId: string): Promise<Registration[]> {
  const result = await getPaginatedRegistrationsByEvent(eventId, { pageSize: 1000 });
  return result.roster;
}

/**
 * Retrieves all registrations for a specific attendee.
 */
export async function getRegistrationsByAttendee(attendeeId: string): Promise<Registration[]> {
  const snapshot = await adminDb
    .collection(REGISTRATIONS_COLLECTION)
    .where('attendeeId', '==', attendeeId)
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as Registration)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}
