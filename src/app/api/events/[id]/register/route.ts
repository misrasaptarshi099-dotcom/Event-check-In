import { NextResponse } from 'next/server';
import { registerForEvent } from '@/lib/services/registrations.service';
import { checkRateLimit, getRateLimitKey, REGISTRATION_LIMIT } from '@/lib/security/rateLimit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;

    // Strict sliding-window rate limit (10 requests/min per IP)
    const rateLimitRes = checkRateLimit(getRateLimitKey(request), REGISTRATION_LIMIT);
    if (rateLimitRes) return rateLimitRes;

    const body = await request.json();
    const { attendeeId, attendeeName, attendeeEmail } = body;

    if (!attendeeName || typeof attendeeName !== 'string' || attendeeName.trim().length === 0) {
      return NextResponse.json({ error: 'Attendee name is required.' }, { status: 400 });
    }

    if (!attendeeEmail || typeof attendeeEmail !== 'string' || !attendeeEmail.includes('@')) {
      return NextResponse.json({ error: 'Valid attendee email is required.' }, { status: 400 });
    }

    // Generate or use attendee ID
    const resolvedAttendeeId = attendeeId && typeof attendeeId === 'string'
      ? attendeeId.trim()
      : `att_${attendeeEmail.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    const registration = await registerForEvent(
      eventId,
      resolvedAttendeeId,
      attendeeName.trim(),
      attendeeEmail.trim().toLowerCase()
    );

    return NextResponse.json({ registration }, { status: 201 });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Registration failed.' }, { status });
  }
}
