import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/**
 * Singleton Firebase Client App
 * Prevents re-initialization in Next.js hot-reload / SSR cycles.
 */
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

/**
 * Firebase Client Auth instance
 */
export const auth: Auth = getAuth(app);

/**
 * Google OAuth Provider instance
 */
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const firestoreDbId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID;

/**
 * Firebase Client Firestore instance
 */
export const db: Firestore =
  firestoreDbId && firestoreDbId !== '(default)'
    ? getFirestore(app, firestoreDbId)
    : getFirestore(app);

/**
 * Retrieves a guaranteed fresh Firebase ID token, automatically refreshing expired tokens.
 */
export async function getFreshAuthToken(forceRefresh = false): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken(forceRefresh);
      localStorage.setItem('vouch_auth_token', token);
      return token;
    }
  } catch (e) {
    console.warn('Could not retrieve fresh auth token:', e);
  }

  return localStorage.getItem('vouch_auth_token');
}

export default app;
