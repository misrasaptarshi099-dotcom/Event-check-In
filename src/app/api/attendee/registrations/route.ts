import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import type { Registration, EventItem } from '@/types';

export interface EnrichedRegistration extends Registration {
  event?: EventItem;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queryEmail = searchParams.get('email')?.trim().toLowerCase();

    if (!queryEmail) {
      return NextResponse.json({ registrations: [] });
    }

    // 1. Fetch registrations for this attendee email
    const regSnap = await adminDb
      .collection('registrations')
      .where('attendeeEmail', '==', queryEmail)
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
        } catch {}
      })
    );

    const enriched: EnrichedRegistration[] = registrations.map((r) => ({
      ...r,
      event: eventMap.get(r.eventId),
    }));

    return NextResponse.json({ registrations: enriched });
  } catch (error: any) {
    console.error('Failed to load attendee registrations:', error);
    return NextResponse.json({ registrations: [], error: error.message }, { status: 500 });
  }
}

