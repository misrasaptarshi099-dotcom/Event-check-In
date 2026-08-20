import { NextResponse } from 'next/server';
import { createEvent, getEventsByOrganizer, getAllPublicEvents } from '@/lib/services/events.service';
import { verifyAuthToken, requireRole } from '@/lib/security/rbac';
import { checkRateLimit, getRateLimitKey, REGISTRATION_LIMIT } from '@/lib/security/rateLimit';

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');

  // If authenticated as organizer, return their events; otherwise return public events
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const user = await verifyAuthToken(authHeader);
      if (user.role === 'organizer') {
        const events = await getEventsByOrganizer(user.uid);
        return NextResponse.json({ events });
      }
    } catch {
      // Fall through to public events
    }
  }

  const events = await getAllPublicEvents();
  return NextResponse.json({ events });
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
    const { name, description, eventDate, capacity, timezone, venue, bannerUrl, ticketPrice, currency } = body;

    // Strict input validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Event name is required.' }, { status: 400 });
    }

    const parsedCapacity = Number(capacity);
    if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
      return NextResponse.json({ error: 'Capacity must be a positive integer.' }, { status: 400 });
    }

    if (!eventDate || isNaN(Date.parse(eventDate))) {
      return NextResponse.json({ error: 'Valid event date is required.' }, { status: 400 });
    }

    const event = await createEvent({
      organizerId: user.uid,
      name: name.trim(),
      description: description?.trim() || undefined,
      eventDate: new Date(eventDate).toISOString(),
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
