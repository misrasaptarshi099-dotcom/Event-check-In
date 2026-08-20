import { NextResponse } from 'next/server';
import { getAllOrganizers, addOrganizer } from '@/lib/services/organizers.service';
import { verifyAuthToken, requireRole } from '@/lib/security/rbac';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const user = await verifyAuthToken(authHeader);
    requireRole(user, 'organizer');

    const organizers = await getAllOrganizers();
    return NextResponse.json({ organizers });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Failed to fetch organizers.' }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const user = await verifyAuthToken(authHeader);
    requireRole(user, 'organizer');

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email address is required.' }, { status: 400 });
    }

    const record = await addOrganizer(email, user.email || user.uid);
    return NextResponse.json({ organizer: record }, { status: 201 });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Failed to add organizer.' }, { status });
  }
}
