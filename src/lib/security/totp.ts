import { authenticator } from 'otplib';

// Configure TOTP parameters: 30s step, 6 digits
authenticator.options = {
  step: 30,
  digits: 6,
  window: 1, // Allow +/- 1 time step drift (30s grace period)
};

export interface QrTokenPayload {
  r: string; // registration_id
  e: string; // event_id
  t: string; // totp code (6 digits)
  ts: number; // timestamp in seconds
}

/**
 * Generates a new cryptographically strong Base32 TOTP secret
 */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Generates the current TOTP token for a given Base32 secret
 */
export function generateTotpToken(secret: string): string {
  return authenticator.generate(secret);
}

/**
 * Verifies a TOTP token against a secret with +/- 1 step drift tolerance
 */
export function verifyTotpToken(token: string, secret: string): boolean {
  try {
    return authenticator.check(token, secret);
  } catch {
    return false;
  }
}

/**
 * Calculates remaining seconds in the current 30-second epoch window
 */
export function getRemainingSeconds(): number {
  const step = 30;
  const currentEpoch = Math.floor(Date.now() / 1000);
  return step - (currentEpoch % step);
}

/**
 * Assembles and serializes the dynamic QR payload
 */
export function createQrPayload(registrationId: string, eventId: string, secret: string): string {
  const payload: QrTokenPayload = {
    r: registrationId,
    e: eventId,
    t: generateTotpToken(secret),
    ts: Math.floor(Date.now() / 1000),
  };
  return JSON.stringify(payload);
}

/**
 * Parses and verifies a scanned dynamic QR payload string
 */
export function parseAndVerifyQrPayload(
  rawPayload: string,
  secret: string
): { isValid: boolean; payload?: QrTokenPayload; error?: string } {
  try {
    const parsed: QrTokenPayload = JSON.parse(rawPayload);
    if (!parsed.r || !parsed.e || !parsed.t) {
      return { isValid: false, error: 'Malformed QR payload format.' };
    }

    const isValid = verifyTotpToken(parsed.t, secret);
    if (!isValid) {
      return { isValid: false, payload: parsed, error: 'TOTP token expired or invalid (anti-screenshot rule).' };
    }

    return { isValid: true, payload: parsed };
  } catch {
    return { isValid: false, error: 'Invalid QR JSON data.' };
  }
}
