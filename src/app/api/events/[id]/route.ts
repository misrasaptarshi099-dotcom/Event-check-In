import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getEventById, updateEvent, deleteEvent } from '@/lib/services/events.service';
import { verifyAuthToken, requireRole } from '@/lib/security/rbac';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (new URL(request.url).searchParams.get('organizerOnly') === 'true') {
      requireRole(await verifyAuthToken(request.headers.get('Authorization')), 'organizer');
    }
    const event = await getEventById(id);
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }
    return NextResponse.json({ event });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch event.' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('Authorization');
    const user = await verifyAuthToken(authHeader);
    requireRole(user, 'organizer');

    const event = await getEventById(id);
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, eventDate, eventEndDate, capacity, timezone, venue, bannerUrl, ticketPrice, currency } = body;

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (description !== undefined) updates.description = String(description).trim();
    if (eventDate !== undefined) updates.eventDate = new Date(eventDate).toISOString();
    if (eventEndDate !== undefined) updates.eventEndDate = eventEndDate ? new Date(eventEndDate).toISOString() : FieldValue.delete();
    if (capacity !== undefined) updates.capacity = Math.max(1, Math.floor(Number(capacity)));
    if (timezone !== undefined) updates.timezone = String(timezone);
    if (venue !== undefined) updates.venue = String(venue).trim();
    if (bannerUrl !== undefined) updates.bannerUrl = String(bannerUrl);
    if (ticketPrice !== undefined) updates.ticketPrice = Math.max(0, Number(ticketPrice));
    if (currency !== undefined) updates.currency = String(currency);

    await updateEvent(id, updates);
    const updated = await getEventById(id);

    return NextResponse.json({ event: updated });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Failed to update event.' }, { status });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('Authorization');
    const user = await verifyAuthToken(authHeader);
    requireRole(user, 'organizer');

    const event = await getEventById(id);
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    await deleteEvent(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Failed to delete event.' }, { status });
  }
}
