import { NextResponse } from 'next/server';
import { computeEventStats } from '@/lib/services/stats.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: eventId } = await params;
    const stats = await computeEventStats(eventId);
    return NextResponse.json({ stats });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to compute stats.' }, { status: 500 });
  }
}
