import { NextResponse } from 'next/server';
import { computeEventStats } from '@/lib/services/stats.service';
import { getEventById } from '@/lib/services/events.service';
import { verifyAuthToken, requireRole, requireOwnership } from '@/lib/security/rbac';

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
    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });

    requireOwnership(user, event.organizerId);

    const stats = await computeEventStats(eventId);
    return NextResponse.json({ stats });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Failed to compute stats.' }, { status });
  }
}
