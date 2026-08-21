import { NextResponse } from 'next/server';
import { getPaginatedRegistrationsByEvent } from '@/lib/services/registrations.service';
import { getEventById } from '@/lib/services/events.service';
import { verifyAuthToken, requireRole, requireOwnership } from '@/lib/security/rbac';
import { checkRateLimit, getRateLimitKey, EXPORT_LIMIT } from '@/lib/security/rateLimit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    const authHeader = request.headers.get('Authorization');
    const user = await verifyAuthToken(authHeader);
    requireRole(user, 'organizer');

    const rateLimitRes = checkRateLimit(getRateLimitKey(request, user.uid), EXPORT_LIMIT);
    if (rateLimitRes) return rateLimitRes;

    const event = await getEventById(eventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    requireOwnership(user, event.organizerId);

    const url = new URL(request.url);
    const pageSize = Number(url.searchParams.get('pageSize')) || 50;
    const cursor = url.searchParams.get('cursor') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const status = url.searchParams.get('status') || undefined;

    const result = await getPaginatedRegistrationsByEvent(eventId, {
      pageSize,
      cursor,
      search,
      status,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Failed to fetch roster.' }, { status });
  }
}
