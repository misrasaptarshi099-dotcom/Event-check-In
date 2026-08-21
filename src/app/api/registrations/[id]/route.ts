import { NextResponse } from 'next/server';
import { getRegistrationById } from '@/lib/services/registrations.service';
import { getEventById } from '@/lib/services/events.service';
import { verifyAuthToken } from '@/lib/security/rbac';
import { checkRateLimit, getRateLimitKey, REGISTRATION_LIMIT } from '@/lib/security/rateLimit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: registrationId } = await params;

    const rateLimitRes = checkRateLimit(getRateLimitKey(request), REGISTRATION_LIMIT);
    if (rateLimitRes) return rateLimitRes;

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to view this pass.' },
        { status: 401 }
      );
    }

    const authUser = await verifyAuthToken(authHeader);
    if (!authUser || !authUser.uid) {
      return NextResponse.json({ error: 'Invalid authentication session.' }, { status: 401 });
    }

    const registration = await getRegistrationById(registrationId);
    if (!registration) {
      return NextResponse.json({ error: 'Registration pass not found.' }, { status: 404 });
    }

    const event = await getEventById(registration.eventId);

    // IDOR Protection: Only the ticket owner, event organizer, or authorized admin can view the pass
    const isOwner = authUser.uid === registration.attendeeId;
    const isEventOrganizer = event ? authUser.uid === event.organizerId : false;
    const isOrganizerRole = authUser.role === 'organizer';

    if (!isOwner && !isEventOrganizer && !isOrganizerRole) {
      return NextResponse.json(
        { error: 'Access denied: You do not have permission to view or access this pass.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      registration,
      event,
    });
  } catch (error: any) {
    const status = error.statusCode || (error.message?.includes('Unauthorized') ? 401 : 500);
    return NextResponse.json({ error: error.message || 'Failed to fetch registration pass.' }, { status });
  }
}
