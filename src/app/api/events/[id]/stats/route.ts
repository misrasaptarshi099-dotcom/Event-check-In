import { NextResponse } from 'next/server';
import { computeEventStats } from '@/lib/services/stats.service';
import { getEventById } from '@/lib/services/events.service';
import { verifyAuthToken, requireRole } from '@/lib/security/rbac';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    requireRole(await verifyAuthToken(request.headers.get('Authorization')), 'organizer');
    if (!await getEventById(eventId)) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    const stats = await computeEventStats(eventId);
    return NextResponse.json({ stats });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to compute stats.' }, { status: 500 });
  }
}
