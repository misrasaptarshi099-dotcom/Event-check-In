import { NextResponse } from 'next/server';
import { computeEventFinance } from '@/lib/services/finance.service';
import { getEventById } from '@/lib/services/events.service';
import { verifyAuthToken, requireRole } from '@/lib/security/rbac';
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

    const event = await getEventById(eventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    // Rate limiting for financial analytics
    const rateLimitRes = checkRateLimit(getRateLimitKey(request, user.uid), EXPORT_LIMIT);
    if (rateLimitRes) return rateLimitRes;

    const finance = await computeEventFinance(eventId);
    return NextResponse.json({ finance });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Failed to compute finance metrics.' }, { status });
  }
}
