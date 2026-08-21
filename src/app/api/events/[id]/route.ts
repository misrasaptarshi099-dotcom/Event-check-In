import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getEventById, updateEvent, deleteEvent } from '@/lib/services/events.service';
import { verifyAuthToken, requireRole, requireOwnership } from '@/lib/security/rbac';
import { sanitizeText, sanitizeUrl, sanitizeInteger } from '@/lib/security/sanitize';

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

    requireOwnership(user, event.organizerId);

    const body = await request.json();
    const updates: Record<string, any> = {};

    if (body.name !== undefined) {
      const cleanName = sanitizeText(body.name, 120);
      if (!cleanName) return NextResponse.json({ error: 'Event name cannot be empty.' }, { status: 400 });
      updates.name = cleanName;
    }

    if (body.description !== undefined) {
      updates.description = sanitizeText(body.description, 2000);
    }

    if (body.eventDate !== undefined) {
      if (isNaN(Date.parse(body.eventDate))) {
        return NextResponse.json({ error: 'Invalid event start date.' }, { status: 400 });
      }
      updates.eventDate = new Date(body.eventDate).toISOString();
    }

    if (body.eventEndDate !== undefined) {
      if (body.eventEndDate) {
        if (isNaN(Date.parse(body.eventEndDate))) {
          return NextResponse.json({ error: 'Invalid event end date.' }, { status: 400 });
        }
        updates.eventEndDate = new Date(body.eventEndDate).toISOString();
      } else {
        updates.eventEndDate = FieldValue.delete();
      }
    }

    if (body.capacity !== undefined) {
      updates.capacity = sanitizeInteger(body.capacity, 1, 100000, event.capacity);
    }

    if (body.timezone !== undefined) {
      updates.timezone = sanitizeText(body.timezone, 50) || 'UTC';
    }

    if (body.venue !== undefined) {
      updates.venue = sanitizeText(body.venue, 200);
    }

    if (body.bannerUrl !== undefined) {
      updates.bannerUrl = sanitizeUrl(body.bannerUrl) || FieldValue.delete();
    }

    if (body.ticketPrice !== undefined) {
      updates.ticketPrice = Math.max(0, Math.min(1000000, Number(body.ticketPrice) || 0));
    }

    if (body.currency !== undefined) {
      updates.currency = ['USD', 'EUR', 'GBP', 'CAD', 'INR'].includes(body.currency) ? body.currency : 'USD';
    }

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

    requireOwnership(user, event.organizerId);

    await deleteEvent(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Failed to delete event.' }, { status });
  }
}
