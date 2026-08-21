import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { syncUserAccount, getUserById } from '@/lib/services/users.service';

export async function GET(request: Request) {
  return handleAuthMe(request);
}

export async function POST(request: Request) {
  return handleAuthMe(request);
}

async function handleAuthMe(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or malformed Authorization header.' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Invalid or expired session token.' }, { status: 401 });
    }

    const uid = decoded.uid;
    const email = (decoded.email || '').trim().toLowerCase();
    const displayName = decoded.name || (email ? email.split('@')[0] : 'Guest Attendee');
    const photoURL = decoded.picture || null;

    // Authoritatively synchronize user account in 3NF `users` collection
    const userAccount = await syncUserAccount({
      uid,
      email,
      displayName,
      photoURL,
    });

    return NextResponse.json({
      user: userAccount,
      role: userAccount.role,
      uid: userAccount.id,
      email: userAccount.email,
    });
  } catch (error: any) {
    console.error('Error in /api/auth/me:', error);
    return NextResponse.json({ error: error.message || 'Failed to authenticate user profile.' }, { status: 500 });
  }
}
