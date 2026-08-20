/**
 * WebCrypto AES-GCM 256-bit Encryption for Offline Scanner Roster
 *
 * Encrypts/decrypts the local roster of TOTP secrets cached in IndexedDB.
 * Key is derived from an organizer-entered PIN via PBKDF2.
 */

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 600_000;
const MIN_PASSPHRASE_LENGTH = 12;

/**
 * Validates the passphrase meets minimum entropy requirements.
 * Rejects short numeric PINs in favor of meaningful passphrases.
 */
function validatePassphrase(passphrase: string): void {
  if (!passphrase || passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(
      `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters. ` +
      'Short numeric PINs do not provide sufficient entropy for roster encryption.'
    );
  }
}

/**
 * Derives an AES-GCM 256-bit CryptoKey from a user passphrase via PBKDF2.
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  validatePassphrase(passphrase);

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts plaintext data using AES-GCM 256-bit with a passphrase-derived key.
 *
 * Output format: [16-byte salt][12-byte IV][ciphertext]
 */
export async function encrypt(plaintext: string, passphrase: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(passphrase, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  // Concatenate: salt | iv | ciphertext
  const result = new Uint8Array(SALT_LENGTH + IV_LENGTH + ciphertext.byteLength);
  result.set(salt, 0);
  result.set(iv, SALT_LENGTH);
  result.set(new Uint8Array(ciphertext), SALT_LENGTH + IV_LENGTH);

  return result.buffer;
}

/**
 * Decrypts AES-GCM 256-bit encrypted data using a passphrase-derived key.
 *
 * Input format: [16-byte salt][12-byte IV][ciphertext]
 */
export async function decrypt(encryptedBuffer: ArrayBuffer, passphrase: string): Promise<string> {
  const decoder = new TextDecoder();
  const data = new Uint8Array(encryptedBuffer);

  const salt = data.slice(0, SALT_LENGTH);
  const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = data.slice(SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(passphrase, salt);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return decoder.decode(plaintext);
}

/**
 * Encrypts a roster array to an ArrayBuffer for IndexedDB storage.
 */
export async function encryptRoster<T>(roster: T[], passphrase: string): Promise<ArrayBuffer> {
  return encrypt(JSON.stringify(roster), passphrase);
}

/**
 * Decrypts an ArrayBuffer from IndexedDB back to the roster array.
 */
export async function decryptRoster<T>(encryptedBuffer: ArrayBuffer, passphrase: string): Promise<T[]> {
  const json = await decrypt(encryptedBuffer, passphrase);
  return JSON.parse(json) as T[];
}
