import { adminDb, adminAuth } from '@/lib/firebase/admin';

const ORGANIZERS_COLLECTION = 'organizers';

export const SEED_ORGANIZER_EMAILS = [
  'misrsaptarshi099@gmail.com',
  'misrasaptarshi099@gmail.com',
];

export interface OrganizerRecord {
  email: string;
  addedBy: string;
  createdAt: string;
  isPrimary?: boolean;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = 2500, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

/**
 * Checks whether an email is an authorized organizer.
 * Checks default seeds, environment list, and Firestore database.
 */
export async function isAuthorizedOrganizer(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();

  // Check hardcoded seed & env overrides (instant)
  if (SEED_ORGANIZER_EMAILS.includes(normalized)) return true;

  const envList = (process.env.ORGANIZER_EMAILS || process.env.NEXT_PUBLIC_ORGANIZER_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (envList.includes(normalized)) return true;

  // Check Firestore organizers collection with 2.5s timeout
  try {
    const doc = await withTimeout(
      adminDb.collection(ORGANIZERS_COLLECTION).doc(normalized).get(),
      2500,
      null
    );
    return doc ? doc.exists : false;
  } catch (err) {
    console.error('Error checking organizer status in Firestore:', err);
    return false;
  }
}

/**
 * Synchronous check for seed/env organizer list.
 */
export function isSeedOrganizer(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (SEED_ORGANIZER_EMAILS.includes(normalized)) return true;
  const envList = (process.env.ORGANIZER_EMAILS || process.env.NEXT_PUBLIC_ORGANIZER_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return envList.includes(normalized);
}

/**
 * Retrieves all authorized organizers.
 */
export async function getAllOrganizers(): Promise<OrganizerRecord[]> {
  const records: Map<string, OrganizerRecord> = new Map();

  // 1. Add seeds
  for (const email of SEED_ORGANIZER_EMAILS) {
    records.set(email, {
      email,
      addedBy: 'System Primary',
      createdAt: '2026-01-01T00:00:00.000Z',
      isPrimary: true,
    });
  }

  // 2. Fetch added organizers from Firestore with timeout protection
  try {
    const snapshot = await withTimeout(
      adminDb.collection(ORGANIZERS_COLLECTION).get(),
      2500,
      null
    );
    if (snapshot) {
      for (const doc of snapshot.docs) {
        const data = doc.data() as OrganizerRecord;
        records.set(doc.id, {
          email: doc.id,
          addedBy: data.addedBy || 'Organizer Admin',
          createdAt: data.createdAt || new Date().toISOString(),
          isPrimary: SEED_ORGANIZER_EMAILS.includes(doc.id),
        });
      }
    }
  } catch (err) {
    console.error('Error listing organizers from Firestore:', err);
  }

  return Array.from(records.values());
}

/**
 * Adds a new organizer. Only an existing authenticated organizer can perform this.
 */
export async function addOrganizer(email: string, addedBy: string): Promise<OrganizerRecord> {
  const normalized = email.trim().toLowerCase();

  // Basic email validation
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Valid email address is required.');
  }

  const now = new Date().toISOString();
  const record: OrganizerRecord = {
    email: normalized,
    addedBy,
    createdAt: now,
  };

  // 1. Save to Firestore
  await adminDb.collection(ORGANIZERS_COLLECTION).doc(normalized).set(record);

  // 2. Attempt to promote existing Firebase Auth user if account already created
  try {
    const user = await adminAuth.getUserByEmail(normalized);
    if (user) {
      await adminAuth.setCustomUserClaims(user.uid, { role: 'organizer' });
    }
  } catch {
    // User might not have signed up with Google yet; they will get promoted upon first login
  }

  return record;
}

/**
 * Removes an organizer. Seed organizers cannot be removed.
 */
export async function removeOrganizer(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();

  if (SEED_ORGANIZER_EMAILS.includes(normalized)) {
    throw new Error('Cannot remove primary system organizer.');
  }

  // 1. Delete from Firestore
  await adminDb.collection(ORGANIZERS_COLLECTION).doc(normalized).delete();

  // 2. Revoke Firebase Auth custom claims if user exists
  try {
    const user = await adminAuth.getUserByEmail(normalized);
    if (user) {
      await adminAuth.setCustomUserClaims(user.uid, { role: 'attendee' });
    }
  } catch {
    // User not found in Firebase Auth yet
  }
}
