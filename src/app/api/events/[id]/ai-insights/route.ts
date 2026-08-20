import { NextResponse } from 'next/server';
import { getAiInsight } from '@/lib/services/ai-insights.service';
import { getEventById } from '@/lib/services/events.service';
import { verifyAuthToken, requireRole } from '@/lib/security/rbac';
import { checkRateLimit, getRateLimitKey, AI_INSIGHTS_LIMIT } from '@/lib/security/rateLimit';

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

    // Strict rate limiting (max 5 AI requests/min per organizer) to prevent billing surges
    const rateLimitRes = checkRateLimit(getRateLimitKey(request, user.uid), AI_INSIGHTS_LIMIT);
    if (rateLimitRes) return rateLimitRes;

    const body = await request.json();
    const { question } = body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json({ error: 'Question query is required.' }, { status: 400 });
    }

    const insight = await getAiInsight(eventId, question.trim());
    return NextResponse.json(insight);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'AI insight query failed.' }, { status });
  }
}
