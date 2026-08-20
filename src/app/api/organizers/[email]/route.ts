import { NextResponse } from 'next/server';
import { removeOrganizer } from '@/lib/services/organizers.service';
import { verifyAuthToken, requireRole } from '@/lib/security/rbac';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    const user = await verifyAuthToken(authHeader);
    requireRole(user, 'organizer');

    const { email } = await params;
    const decodedEmail = decodeURIComponent(email);

    await removeOrganizer(decodedEmail);
    return NextResponse.json({ success: true, removed: decodedEmail });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Failed to remove organizer.' }, { status });
  }
}
