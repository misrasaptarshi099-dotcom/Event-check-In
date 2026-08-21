import { NextResponse } from 'next/server';
import { createEvent, getAllOrganizerEvents, getEventsByOrganizer, getAllPublicEvents } from '@/lib/services/events.service';
import { verifyAuthToken, requireRole } from '@/lib/security/rbac';
import { checkRateLimit, getRateLimitKey, REGISTRATION_LIMIT } from '@/lib/security/rateLimit';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizerOnly = searchParams.get('organizerOnly') === 'true';

    // If explicit organizer portfolio requested
    if (organizerOnly) {
      const user = await verifyAuthToken(request.headers.get('Authorization'));
      requireRole(user, 'organizer');
      return NextResponse.json({ events: await getEventsByOrganizer(user.uid) });
    }

    // Default fast path: Return all public events
    const events = await getAllPublicEvents();
    return NextResponse.json({ events });
  } catch (error: any) {
    console.error('Failed to fetch events:', error);
    return NextResponse.json({ events: [], error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const user = await verifyAuthToken(authHeader);
    requireRole(user, 'organizer');

    // Rate limit event creation per organizer
    const rateLimitRes = checkRateLimit(getRateLimitKey(request, user.uid), REGISTRATION_LIMIT);
    if (rateLimitRes) return rateLimitRes;

    const body = await request.json();
    const { name, description, eventDate, eventEndDate, capacity, timezone, venue, bannerUrl, ticketPrice, currency } = body;

    // Strict input validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Event name is required.' }, { status: 400 });
    }

    const parsedCapacity = Number(capacity);
    if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
      return NextResponse.json({ error: 'Capacity must be a positive integer.' }, { status: 400 });
    }

    if (!eventDate || isNaN(Date.parse(eventDate))) {
      return NextResponse.json({ error: 'Valid event start date is required.' }, { status: 400 });
    }

    let parsedEndDate: string | undefined = undefined;
    if (eventEndDate) {
      if (isNaN(Date.parse(eventEndDate))) {
        return NextResponse.json({ error: 'Invalid event end date.' }, { status: 400 });
      }
      if (new Date(eventEndDate).getTime() < new Date(eventDate).getTime()) {
        return NextResponse.json({ error: 'Event end time cannot be before start time.' }, { status: 400 });
      }
      parsedEndDate = new Date(eventEndDate).toISOString();
    }

    const event = await createEvent({
      organizerId: user.uid,
      name: name.trim(),
      description: description?.trim() || undefined,
      eventDate: new Date(eventDate).toISOString(),
      eventEndDate: parsedEndDate,
      capacity: Math.floor(parsedCapacity),
      timezone: timezone || 'UTC',
      venue: venue?.trim() || undefined,
      bannerUrl: bannerUrl || undefined,
      ticketPrice: ticketPrice !== undefined ? Math.max(0, Number(ticketPrice)) : 0,
      currency: currency || 'USD',
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Failed to create event.' }, { status });
  }
}
