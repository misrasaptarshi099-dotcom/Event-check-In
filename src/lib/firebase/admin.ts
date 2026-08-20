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

  const serviceAccount: ServiceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  };

  return initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const adminApp = getAdminApp();

/**
 * Firebase Admin Auth instance (server-side)
 * Used for verifying ID tokens, setting custom claims (RBAC), and managing users.
 */
export const adminAuth: Auth = getAuth(adminApp);

/**
 * Firebase Admin Firestore instance (server-side)
 * Used for atomic transactions (runTransaction) in API route handlers.
 */
export const adminDb: Firestore = getFirestore(adminApp);

export default adminApp;
