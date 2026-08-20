import { NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/security/rbac';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const user = await verifyAuthToken(authHeader);

    return NextResponse.json({
      uid: user.uid,
      email: user.email,
      role: user.role,
    });
  } catch (error: any) {
    const status = error.statusCode || 401;
    return NextResponse.json({ error: error.message || 'Authentication check failed.' }, { status });
  }
}
