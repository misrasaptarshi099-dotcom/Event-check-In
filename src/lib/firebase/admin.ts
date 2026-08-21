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

export function formatFirebasePrivateKey(key: string): string {
  if (!key) return '';

  let formatted = key.trim();

  // 1. Strip wrapping quotes
  if (
    (formatted.startsWith('"') && formatted.endsWith('"')) ||
    (formatted.startsWith("'") && formatted.endsWith("'"))
  ) {
    formatted = formatted.slice(1, -1);
  }

  // 2. Normalize escaped newlines
  formatted = formatted.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');

  // 3. Base64 check if user pasted a base64 encoded PEM key
  if (!formatted.includes('-----BEGIN PRIVATE KEY-----')) {
    try {
      const decoded = Buffer.from(formatted, 'base64').toString('utf8');
      if (decoded.includes('-----BEGIN PRIVATE KEY-----')) {
        formatted = decoded;
      }
    } catch {
      // not base64
    }
  }

  // 4. Reconstruct standard 64-char chunked PEM key
  const header = '-----BEGIN PRIVATE KEY-----';
  const footer = '-----END PRIVATE KEY-----';

  if (formatted.includes(header) && formatted.includes(footer)) {
    const rawBody = formatted
      .replace(header, '')
      .replace(footer, '')
      .replace(/\s+/g, '');

    const chunks = rawBody.match(/.{1,64}/g) || [];
    formatted = `${header}\n${chunks.join('\n')}\n${footer}\n`;
  }

  return formatted;
}

export function getAdminApp(): App {
  if (cachedApp) return cachedApp;

  if (getApps().length > 0) {
    cachedApp = getApps()[0];
    return cachedApp;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    const missing: string[] = [];
    if (!projectId) missing.push('FIREBASE_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID)');
    if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
    if (!privateKeyRaw) missing.push('FIREBASE_PRIVATE_KEY');

    throw new Error(
      `Firebase Admin SDK configuration error on server: Missing required environment variables: [${missing.join(', ')}]. ` +
      'Please verify these are configured in your Vercel Project Settings -> Environment Variables.'
    );
  }

  const formattedPrivateKey = formatFirebasePrivateKey(privateKeyRaw);

  const serviceAccount: ServiceAccount = {
    projectId,
    clientEmail,
    privateKey: formattedPrivateKey,
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
