import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

export async function GET() {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    status: 'ok',
    environment: {
      hasProjectId: !!(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
      hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      hasNextPublicApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      hasNextPublicAuthDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    },
    firestore: 'unknown',
    auth: 'unknown',
  };

  try {
    const testDoc = await adminDb.collection('events').limit(1).get();
    diagnostics.firestore = `connected (events count: ${testDoc.size})`;
  } catch (dbErr: any) {
    diagnostics.status = 'error';
    diagnostics.firestore = `error: ${dbErr.message || dbErr}`;
  }

  try {
    // Test auth service instance
    const authApp = adminAuth.app.name;
    diagnostics.auth = `initialized (app: ${authApp})`;
  } catch (authErr: any) {
    diagnostics.status = 'error';
    diagnostics.auth = `error: ${authErr.message || authErr}`;
  }

  const statusCode = diagnostics.status === 'ok' ? 200 : 500;
  return NextResponse.json(diagnostics, { status: statusCode });
}
