import { adminAuth } from '@/lib/firebase/admin';
import type { UserRole } from '@/types';

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
 * Throws if the token is invalid, expired, or missing.
 */
export async function verifyAuthToken(authHeader: string | null): Promise<AuthenticatedUser> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError(401, 'Missing or malformed Authorization header.');
  }

  const idToken = authHeader.replace('Bearer ', '');

  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    return {
      uid: decoded.uid,
      email: decoded.email || '',
      role: (decoded.role as UserRole) || 'attendee',
    };
  } catch {
    throw new AuthError(401, 'Invalid or expired authentication token.');
  }
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
