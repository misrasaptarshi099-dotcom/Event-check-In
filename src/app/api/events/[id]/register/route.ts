import { NextResponse } from 'next/server';
import { registerForEvent } from '@/lib/services/registrations.service';
import { verifyAuthToken } from '@/lib/security/rbac';
import { checkRateLimit, getRateLimitKey, REGISTRATION_LIMIT } from '@/lib/security/rateLimit';
import { sanitizeText, sanitizeEmail, sanitizeInteger } from '@/lib/security/sanitize';

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
    const cleanName = sanitizeText(body.attendeeName, 100);

    if (!cleanName) {
      return NextResponse.json({ error: 'Attendee name is required.' }, { status: 400 });
    }

    let cleanEmail = '';
    try {
      cleanEmail = sanitizeEmail(body.attendeeEmail);
    } catch {
      return NextResponse.json({ error: 'Valid attendee email is required.' }, { status: 400 });
    }

    // 2. Strict Identity Enforcement: Cannot register with a different email than authenticated account
    const normalizedAuthEmail = authUser.email.trim().toLowerCase();

    if (normalizedAuthEmail !== cleanEmail) {
      return NextResponse.json(
        {
          error: `Identity mismatch: You are signed in as ${normalizedAuthEmail}. You cannot register using a different email address (${cleanEmail}).`,
        },
        { status: 403 }
      );
    }

    // 3. Validate guest count: 1–5 (includes the registrant)
    const guestCount = sanitizeInteger(body.guestCount, 1, 5, 1);

    // Generate authoritative attendee ID tied to user UID
    const resolvedAttendeeId = authUser.uid;

    const registration = await registerForEvent(
      eventId,
      resolvedAttendeeId,
      cleanName,
      normalizedAuthEmail,
      guestCount
    );

    return NextResponse.json({ registration }, { status: 201 });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Registration failed.' }, { status });
  }
}
