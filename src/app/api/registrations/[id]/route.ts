import { NextResponse } from 'next/server';
import { getRegistrationById } from '@/lib/services/registrations.service';
import { getEventById } from '@/lib/services/events.service';
import { checkRateLimit, getRateLimitKey, REGISTRATION_LIMIT } from '@/lib/security/rateLimit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: registrationId } = await params;

    const rateLimitRes = checkRateLimit(getRateLimitKey(request), REGISTRATION_LIMIT);
    if (rateLimitRes) return rateLimitRes;

    const registration = await getRegistrationById(registrationId);
    if (!registration) {
      return NextResponse.json({ error: 'Registration pass not found.' }, { status: 404 });
    }

    const event = await getEventById(registration.eventId);

    return NextResponse.json({
      registration,
      event,
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Failed to fetch registration pass.' }, { status });
  }
}
