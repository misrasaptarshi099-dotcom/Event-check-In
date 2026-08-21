import { NextResponse } from 'next/server';
import { cancelEntireEvent, getEventById } from '@/lib/services/events.service';
import { verifyAuthToken, requireRole, requireOwnership } from '@/lib/security/rbac';
import { sanitizeText } from '@/lib/security/sanitize';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    const authHeader = request.headers.get('Authorization');
    const user = await verifyAuthToken(authHeader);
    requireRole(user, 'organizer');

    const event = await getEventById(eventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    requireOwnership(user, event.organizerId);

    const body = await request.json().catch(() => ({}));
    const cancellationReason = sanitizeText(body.reason || '', 1000) || 'Event cancelled by the host.';

    const result = await cancelEntireEvent(eventId, user, cancellationReason);

    return NextResponse.json({
      success: true,
      message: 'Event has been successfully cancelled and all attendee passes have been refunded.',
      ...result,
    });
  } catch (error: any) {
    const status = error.statusCode || (error.message?.includes('Unauthorized') ? 403 : 500);
    return NextResponse.json({ error: error.message || 'Failed to cancel event.' }, { status });
  }
}
