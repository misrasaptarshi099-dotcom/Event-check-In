import {
  initializeApp,
  getApps,
  cert,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Firebase Admin SDK — server-side only.
 *
 * Initializes using environment variables from .env.local:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY  (PEM, newlines escaped as \n)
 */
function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error(
      'Firebase Admin SDK configuration error: ' +
      'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY must all be set.'
    );
  }

  const serviceAccount: ServiceAccount = {
    projectId,
    clientEmail,
    privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
  };

  return initializeApp({
    credential: cert(serviceAccount),
    projectId,
  });
}

const adminApp = getAdminApp();

/**
 * Firebase Admin Auth instance (server-side)
 * Used for verifying ID tokens, setting custom claims (RBAC), and managing users.
 */
export const adminAuth: Auth = getAuth(adminApp);

const firestoreDbId = process.env.FIRESTORE_DATABASE_ID || process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID;

/**
 * Firebase Admin Firestore instance (server-side)
 * Used for atomic transactions (runTransaction) in API route handlers.
 */
export const adminDb: Firestore =
  firestoreDbId && firestoreDbId !== '(default)'
    ? getFirestore(adminApp, firestoreDbId)
    : getFirestore(adminApp);

export default adminApp;
