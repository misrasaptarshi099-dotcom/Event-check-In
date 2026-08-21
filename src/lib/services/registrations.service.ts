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

    // 2. Validate event lifecycle: Registration closes once event starts or if cancelled
    if (event.status === 'cancelled') {
      throw new RegistrationError(400, 'Registration is closed. This event has been cancelled by the host.');
    }

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
 * Retrieves a registration by ID, enriching with gate check-in status.
 */
export async function getRegistrationById(regId: string): Promise<Registration | null> {
  const doc = await adminDb.collection(REGISTRATIONS_COLLECTION).doc(regId).get();
  if (!doc.exists) return null;
  const reg = doc.data() as Registration;

  // Check gate admission status
  try {
    const checkinDoc = await adminDb
      .collection('events')
      .doc(reg.eventId)
      .collection('checkins')
      .doc(regId)
      .get();

    if (checkinDoc.exists) {
      const checkinData = checkinDoc.data();
      reg.checkedIn = true;
      reg.checkedInAt = checkinData?.checkedInAt || checkinData?.createdAt;
    }
  } catch (err) {
    console.error(`Failed to verify check-in status for registration ${regId}:`, err);
  }

  return reg;
}

/**
 * Atomic Ticket Cancellation with Capacity Restoration & Refund Logging.
 *
 * Runs inside a Firestore transaction to:
 * 1. Read the registration document and verify it exists and is currently 'active'.
 * 2. Read the event document.
 * 3. Verify requester permissions (must be the attendee themselves or event organizer).
 * 4. Verify attendee has not already been scanned / checked in at the gate.
 * 5. Verify cancellation deadline (attendees can only cancel up to 30 minutes before event start).
 * 6. Atomically mark registration as 'cancelled' with cancelledAt and cancelledBy.
 * 7. Atomically restore seats to the event: `spotsRemaining = Math.min(capacity, spotsRemaining + guestCount)`.
 */
export async function cancelRegistration(
  registrationId: string,
  requester: { uid: string; email?: string; role?: string }
): Promise<{ registration: Registration; refundedAmount: number; seatsRestored: number }> {
  const regRef = adminDb.collection(REGISTRATIONS_COLLECTION).doc(registrationId);

  return adminDb.runTransaction(async (transaction) => {
    const regSnap = await transaction.get(regRef);
    if (!regSnap.exists) {
      throw new RegistrationError(404, 'Registration not found.');
    }

    const reg = regSnap.data() as Registration;
    if (reg.status === 'cancelled') {
      throw new RegistrationError(400, 'This registration has already been cancelled.');
    }

    const eventRef = adminDb.collection(EVENTS_COLLECTION).doc(reg.eventId);
    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists) {
      throw new RegistrationError(404, 'Event not found.');
    }

    const event = eventSnap.data() as EventItem;

    // Authorization: Requester must be the registered attendee or the event organizer
    const isOwner =
      requester.uid === reg.attendeeId ||
      (!!requester.email && requester.email.toLowerCase() === reg.attendeeEmail.toLowerCase());
    const isOrganizer = requester.uid === event.organizerId || requester.role === 'organizer';

    if (!isOwner && !isOrganizer) {
      throw new RegistrationError(403, 'You are not authorized to cancel this ticket reservation.');
    }

    // Check if attendee was already checked in at the gate
    const checkinRef = adminDb.collection('events').doc(reg.eventId).collection('checkins').doc(registrationId);
    const checkinSnap = await transaction.get(checkinRef);
    if (checkinSnap.exists || reg.checkedIn) {
      throw new RegistrationError(400, 'Cannot cancel a ticket that has already been admitted at the gate.');
    }

    // 30-Minute Cancellation Deadline Policy (Applies to Attendees)
    const eventStartMs = new Date(event.eventDate).getTime();
    const cancellationDeadlineMs = eventStartMs - (30 * 60 * 1000);
    if (Date.now() >= cancellationDeadlineMs && !isOrganizer) {
      throw new RegistrationError(
        400,
        'Ticket cancellation window has closed. Reservations can only be cancelled up to 30 minutes prior to event start.'
      );
    }

    const seatsToRestore = reg.guestCount || 1;
    const unitPrice = reg.ticketPrice !== undefined ? reg.ticketPrice : (event.ticketPrice || 0);
    const refundedAmount = unitPrice * seatsToRestore;
    const nowIso = new Date().toISOString();

    // 1. Update Registration to cancelled
    const updatedReg: Registration = {
      ...reg,
      status: 'cancelled',
      cancelledAt: nowIso,
      cancelledBy: requester.uid,
    };
    transaction.update(regRef, {
      status: 'cancelled',
      cancelledAt: nowIso,
      cancelledBy: requester.uid,
    });

    // 2. Restore event capacity
    const newSpotsRemaining = Math.min(event.capacity, (event.spotsRemaining || 0) + seatsToRestore);
    transaction.update(eventRef, {
      spotsRemaining: newSpotsRemaining,
    });

    return {
      registration: updatedReg,
      refundedAmount,
      seatsRestored: seatsToRestore,
    };
  });
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
 * Retrieves all registrations for a specific attendee, enriching with gate check-in status.
 */
export async function getRegistrationsByAttendee(attendeeId: string): Promise<Registration[]> {
  const snapshot = await adminDb
    .collection(REGISTRATIONS_COLLECTION)
    .where('attendeeId', '==', attendeeId)
    .get();

  const registrations = snapshot.docs.map((doc) => doc.data() as Registration);

  // Check gate admission status across attendee events
  await Promise.all(
    registrations.map(async (reg) => {
      try {
        const checkinDoc = await adminDb
          .collection('events')
          .doc(reg.eventId)
          .collection('checkins')
          .doc(reg.id)
          .get();

        if (checkinDoc.exists) {
          const checkinData = checkinDoc.data();
          reg.checkedIn = true;
          reg.checkedInAt = checkinData?.checkedInAt || checkinData?.createdAt;
        }
      } catch (err) {
        console.error(`Failed to verify check-in for attendee registration ${reg.id}:`, err);
      }
    })
  );

  return registrations.sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

