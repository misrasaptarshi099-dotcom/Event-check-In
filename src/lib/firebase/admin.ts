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
let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

export function getAdminApp(): App {
  if (cachedApp) return cachedApp;

  if (getApps().length > 0) {
    cachedApp = getApps()[0];
    return cachedApp;
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

  cachedApp = initializeApp({
    credential: cert(serviceAccount),
    projectId,
  });

  return cachedApp;
}

export function getAdminAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(getAdminApp());
  }
  return cachedAuth;
}

export function getAdminDb(): Firestore {
  if (!cachedDb) {
    const app = getAdminApp();
    const firestoreDbId = process.env.FIRESTORE_DATABASE_ID || process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID;
    cachedDb =
      firestoreDbId && firestoreDbId !== '(default)'
        ? getFirestore(app, firestoreDbId)
        : getFirestore(app);
  }
  return cachedDb;
}

/**
 * Lazy Proxy instances so module evaluation does not throw configuration errors
 * until an actual property or method is accessed.
 */
export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    const instance = getAdminAuth();
    const val = (instance as any)[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  },
});

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_target, prop) {
    const instance = getAdminDb();
    const val = (instance as any)[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  },
});

export default adminAuth;
