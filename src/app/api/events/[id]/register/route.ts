import { NextResponse } from 'next/server';
import { registerForEvent } from '@/lib/services/registrations.service';
import { verifyAuthToken } from '@/lib/security/rbac';
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

    // 1. Enforce Authentication: User MUST be signed in with Google
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to register for events.' },
        { status: 401 }
      );
    }

    const authUser = await verifyAuthToken(authHeader);
    if (!authUser || !authUser.email) {
      return NextResponse.json(
        { error: 'Valid authentication session required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { attendeeName, attendeeEmail, guestCount: rawGuestCount } = body;

    if (!attendeeName || typeof attendeeName !== 'string' || attendeeName.trim().length === 0) {
      return NextResponse.json({ error: 'Attendee name is required.' }, { status: 400 });
    }

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!attendeeEmail || typeof attendeeEmail !== 'string' || !EMAIL_REGEX.test(attendeeEmail.trim())) {
      return NextResponse.json({ error: 'Valid attendee email is required.' }, { status: 400 });
    }

    // 2. Strict Identity Enforcement: Cannot register with a different email than authenticated account
    const normalizedAuthEmail = authUser.email.trim().toLowerCase();
    const normalizedInputEmail = attendeeEmail.trim().toLowerCase();

    if (normalizedAuthEmail !== normalizedInputEmail) {
      return NextResponse.json(
        {
          error: `Identity mismatch: You are signed in as ${normalizedAuthEmail}. You cannot register using a different email address (${normalizedInputEmail}).`,
        },
        { status: 403 }
      );
    }

    // 3. Validate guest count: 1–5 (includes the registrant)
    const guestCount = Math.floor(Number(rawGuestCount) || 1);
    if (guestCount < 1 || guestCount > 5) {
      return NextResponse.json({ error: 'Guest count must be between 1 and 5.' }, { status: 400 });
    }

    // Generate authoritative attendee ID tied to user UID
    const resolvedAttendeeId = authUser.uid;

    const registration = await registerForEvent(
      eventId,
      resolvedAttendeeId,
      attendeeName.trim(),
      normalizedAuthEmail,
      guestCount
    );

    return NextResponse.json({ registration }, { status: 201 });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Registration failed.' }, { status });
  }
}
