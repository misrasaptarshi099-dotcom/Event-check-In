import { NextResponse } from 'next/server';
import { cancelRegistration, RegistrationError } from '@/lib/services/registrations.service';
import { verifyAuthToken } from '@/lib/security/rbac';
import { checkRateLimit, getRateLimitKey, REGISTRATION_LIMIT } from '@/lib/security/rateLimit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: registrationId } = await params;

    // Rate limiting
    const rateLimitRes = checkRateLimit(getRateLimitKey(request), REGISTRATION_LIMIT);
    if (rateLimitRes) return rateLimitRes;

    // Authentication
    const authHeader = request.headers.get('Authorization');
    const user = await verifyAuthToken(authHeader);

    const result = await cancelRegistration(registrationId, user);

    return NextResponse.json({
      success: true,
      registration: result.registration,
      refundedAmount: result.refundedAmount,
      seatsRestored: result.seatsRestored,
      message: 'Ticket reservation cancelled and refunded successfully.',
    });
  } catch (error: any) {
    const status = error instanceof RegistrationError ? error.statusCode : (error.statusCode || 500);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel registration.' },
      { status }
    );
  }
}
