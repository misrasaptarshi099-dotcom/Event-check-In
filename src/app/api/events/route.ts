import { NextResponse } from 'next/server';
import { createEvent, getAllOrganizerEvents, getEventsByOrganizer, getAllPublicEvents } from '@/lib/services/events.service';
import { verifyAuthToken, requireRole } from '@/lib/security/rbac';
import { checkRateLimit, getRateLimitKey, REGISTRATION_LIMIT } from '@/lib/security/rateLimit';
import { sanitizeText, sanitizeUrl, sanitizeInteger } from '@/lib/security/sanitize';

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
    const cleanName = sanitizeText(body.name, 120);

    // Strict input validation
    if (!cleanName) {
      return NextResponse.json({ error: 'Event name is required.' }, { status: 400 });
    }

    const parsedCapacity = sanitizeInteger(body.capacity, 1, 100000, 0);
    if (parsedCapacity <= 0) {
      return NextResponse.json({ error: 'Capacity must be a positive integer (1–100,000).' }, { status: 400 });
    }

    const eventDate = body.eventDate;
    if (!eventDate || isNaN(Date.parse(eventDate))) {
      return NextResponse.json({ error: 'Valid event start date is required.' }, { status: 400 });
    }

    let parsedEndDate: string | undefined = undefined;
    if (body.eventEndDate) {
      if (isNaN(Date.parse(body.eventEndDate))) {
        return NextResponse.json({ error: 'Invalid event end date.' }, { status: 400 });
      }
      if (new Date(body.eventEndDate).getTime() < new Date(eventDate).getTime()) {
        return NextResponse.json({ error: 'Event end time cannot be before start time.' }, { status: 400 });
      }
      parsedEndDate = new Date(body.eventEndDate).toISOString();
    }

    const cleanDescription = sanitizeText(body.description, 2000) || undefined;
    const cleanVenue = sanitizeText(body.venue, 200) || undefined;
    const cleanBannerUrl = sanitizeUrl(body.bannerUrl);
    const cleanTimezone = sanitizeText(body.timezone, 50) || 'UTC';
    const cleanCurrency = ['USD', 'EUR', 'GBP', 'CAD', 'INR'].includes(body.currency) ? body.currency : 'USD';
    const cleanPrice = Math.max(0, Math.min(1000000, Number(body.ticketPrice) || 0));

    const event = await createEvent({
      organizerId: user.uid,
      name: cleanName,
      description: cleanDescription,
      eventDate: new Date(eventDate).toISOString(),
      eventEndDate: parsedEndDate,
      capacity: parsedCapacity,
      timezone: cleanTimezone,
      venue: cleanVenue,
      bannerUrl: cleanBannerUrl,
      ticketPrice: cleanPrice,
      currency: cleanCurrency,
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Failed to create event.' }, { status });
  }
}
