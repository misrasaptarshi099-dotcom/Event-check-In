import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { isAuthorizedOrganizer, SEED_ORGANIZER_EMAILS } from './organizers.service';
import type { UserAccount, UserRole } from '@/types';

export const USERS_COLLECTION = 'users';

export interface SyncUserParams {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
}

/**
 * Authoritatively creates or synchronizes a user account in the Firestore 3NF `users` collection.
 * Evaluates role against organizer seeds/database and syncs Firebase Auth Custom Claims.
 */
export async function syncUserAccount(params: SyncUserParams): Promise<UserAccount> {
  const { uid, email, displayName, photoURL } = params;
  const normalizedEmail = (email || '').trim().toLowerCase();

  if (!uid) {
    throw new Error('User UID is required for account synchronization.');
  }

  const userRef = adminDb.collection(USERS_COLLECTION).doc(uid);
  const now = new Date().toISOString();

  // Check if email qualifies for organizer status (seed or Firestore organizers collection)
  const isOrganizer = await isAuthorizedOrganizer(normalizedEmail);
  const targetRole: UserRole = isOrganizer ? 'organizer' : 'attendee';

  const userDoc = await userRef.get();

  let account: UserAccount;

  if (userDoc.exists) {
    const existing = userDoc.data() as UserAccount;
    // Retain existing organizer role if already set, or promote if matched
    const resolvedRole: UserRole = existing.role === 'organizer' || isOrganizer ? 'organizer' : 'attendee';

    const updates: Partial<UserAccount> = {
      email: normalizedEmail || existing.email,
      displayName: displayName?.trim() || existing.displayName || 'Guest Attendee',
      photoURL: photoURL || existing.photoURL,
      role: resolvedRole,
      lastLoginAt: now,
      updatedAt: now,
    };

    await userRef.update(updates);

    account = {
      ...existing,
      ...updates,
    };
  } else {
    // Brand new user registration in 3NF `users` table
    account = {
      id: uid,
      email: normalizedEmail,
      displayName: displayName?.trim() || (normalizedEmail ? normalizedEmail.split('@')[0] : 'Guest Attendee'),
      photoURL: photoURL || undefined,
      role: targetRole,
      accountStatus: 'active',
      createdAt: now,
      lastLoginAt: now,
      updatedAt: now,
    };

    await userRef.set(account);
  }

  // Authoritatively synchronize Firebase Auth custom claims in background
  try {
    await adminAuth.setCustomUserClaims(uid, { role: account.role });
  } catch (claimErr) {
    console.warn(`Failed to set custom claim on user [${uid}]:`, claimErr);
  }

  return account;
}

/**
 * Retrieves a user account by Firebase Auth UID.
 */
export async function getUserById(uid: string): Promise<UserAccount | null> {
  if (!uid) return null;
  const doc = await adminDb.collection(USERS_COLLECTION).doc(uid).get();
  if (!doc.exists) return null;
  return doc.data() as UserAccount;
}

/**
 * Retrieves a user account by normalized email address.
 */
export async function getUserByEmail(email: string): Promise<UserAccount | null> {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  const snapshot = await adminDb
    .collection(USERS_COLLECTION)
    .where('email', '==', normalized)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as UserAccount;
}

/**
 * Updates a user's role and sets custom claims.
 */
export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  const now = new Date().toISOString();
  await adminDb.collection(USERS_COLLECTION).doc(uid).update({
    role,
    updatedAt: now,
  });

  try {
    await adminAuth.setCustomUserClaims(uid, { role });
  } catch (err) {
    console.warn(`Failed to set custom claim for user [${uid}]:`, err);
  }
}
