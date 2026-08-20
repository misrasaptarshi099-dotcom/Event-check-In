import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/security/rbac';
import type { Registration, EventItem } from '@/types';

export interface EnrichedRegistration extends Registration {
  event?: EventItem;
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ registrations: [] });
    }

    let userEmail: string;
    try {
      const authUser = await verifyAuthToken(authHeader);
      if (!authUser || !authUser.email) {
        return NextResponse.json({ registrations: [] });
      }
      userEmail = authUser.email.trim().toLowerCase();
    } catch {
      return NextResponse.json({ registrations: [] });
    }

    // 1. Fetch registrations for this authenticated attendee email only
    const regSnap = await adminDb
      .collection('registrations')
      .where('attendeeEmail', '==', userEmail)
      .get();

    const registrations = regSnap.docs
      .map((doc) => doc.data() as Registration)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    if (registrations.length === 0) {
      return NextResponse.json({ registrations: [] });
    }

    // 2. Fetch corresponding event metadata
    const eventIds = Array.from(new Set(registrations.map((r) => r.eventId)));
    const eventMap = new Map<string, EventItem>();

    await Promise.all(
      eventIds.map(async (evId) => {
        try {
          const doc = await adminDb.collection('events').doc(evId).get();
          if (doc.exists) {
            eventMap.set(evId, doc.data() as EventItem);
          }
        } catch (eventErr) {
          console.error(`Failed to load event metadata for event ID [${evId}]:`, eventErr);
        }
      })
    );

    const enriched: EnrichedRegistration[] = registrations.map((r) => ({
      ...r,
      event: eventMap.get(r.eventId),
    }));

    return NextResponse.json({ registrations: enriched });
  } catch (error: any) {
    console.error('Failed to load attendee registrations:', error);
    return NextResponse.json({ registrations: [], error: 'Failed to load registrations.' }, { status: 500 });
  }
}

