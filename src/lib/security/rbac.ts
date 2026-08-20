import { adminAuth } from '@/lib/firebase/admin';
import { isAuthorizedOrganizer, SEED_ORGANIZER_EMAILS } from '@/lib/services/organizers.service';
import type { UserRole } from '@/types';

export { SEED_ORGANIZER_EMAILS };

/**
 * Synchronously checks if an email matches seed organizer list.
 */
export function isOrganizerEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const envList = (process.env.ORGANIZER_EMAILS || process.env.NEXT_PUBLIC_ORGANIZER_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return SEED_ORGANIZER_EMAILS.includes(normalized) || envList.includes(normalized);
}

/**
 * Server-side RBAC enforcement for API route handlers.
 *
 * Verifies the Firebase ID token from the Authorization header
 * and checks the user's custom claim role against the required role(s).
 */
export interface AuthenticatedUser {
  uid: string;
  email: string;
  role: UserRole;
}

/**
 * Verifies a Firebase ID token and extracts the authenticated user.
 * Automatically resolves organizer role for authorized emails.
 */
export async function verifyAuthToken(authHeader: string | null): Promise<AuthenticatedUser> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError(401, 'Missing or malformed Authorization header.');
  }

  const token = authHeader.replace('Bearer ', '').trim();

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch (error: any) {
    throw new AuthError(401, error.message || 'Invalid or expired authentication token.');
  }

  const email = decoded.email || '';

  // Check if email is an authorized organizer (seed or database)
  const hasOrganizerAccess = await isAuthorizedOrganizer(email);
  let role: UserRole = hasOrganizerAccess ? 'organizer' : ((decoded.role as UserRole) || 'attendee');

  // If user is an authorized organizer but custom claim not set yet, set it asynchronously
  if (hasOrganizerAccess && decoded.role !== 'organizer') {
    adminAuth.setCustomUserClaims(decoded.uid, { role: 'organizer' }).catch(() => {});
  }

  return {
    uid: decoded.uid,
    email,
    role,
  };
}

/**
 * Asserts the authenticated user has the required role.
 * Throws 403 Forbidden if the role check fails.
 */
export function requireRole(user: AuthenticatedUser, ...allowedRoles: UserRole[]): void {
  if (!allowedRoles.includes(user.role)) {
    throw new AuthError(403, `Forbidden: requires role [${allowedRoles.join(' | ')}], got [${user.role}].`);
  }
}

/**
 * Asserts the authenticated user owns the resource.
 * Throws 403 Forbidden if ownership check fails.
 */
export function requireOwnership(user: AuthenticatedUser, resourceOwnerId: string): void {
  if (user.uid !== resourceOwnerId) {
    throw new AuthError(403, 'Forbidden: you do not own this resource.');
  }
}

/**
 * Sets the role custom claim on a Firebase Auth user.
 * Used during user registration or role promotion.
 */
export async function setUserRole(uid: string, role: UserRole): Promise<void> {
  await adminAuth.setCustomUserClaims(uid, { role });
}

/**
 * Custom error class for authentication/authorization failures.
 */
export class AuthError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}
