/**
 * Input sanitization, validation, and defense-in-depth cybersecurity utilities.
 * Protects API boundaries against XSS, NoSQL/Firestore injection, URL scheme hijacking,
 * prompt overflow denial of service, and parameter tampering.
 */

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Sanitizes arbitrary text input by removing control characters, stripping script tags,
 * and clamping max length to prevent buffer/payload bloat.
 */
export function sanitizeText(input: unknown, maxLength = 255): string {
  if (input === null || input === undefined) return '';
  let str = String(input);

  // Remove null bytes and non-printable control characters (except newline \n and tab \t)
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Strip dangerous HTML/Script tags to prevent stored XSS
  str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  str = str.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  str = str.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  str = str.replace(/on\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  return str.trim().slice(0, maxLength);
}

/**
 * Validates and normalizes email addresses.
 * Throws a formatted validation error if invalid.
 */
export function sanitizeEmail(input: unknown): string {
  const email = sanitizeText(input, 150).toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new Error('Invalid email address format.');
  }
  return email;
}

/**
 * Validates and clamps an integer input within a strictly bounded range.
 */
export function sanitizeInteger(input: unknown, min: number, max: number, fallback: number): number {
  const num = Number(input);
  if (isNaN(num) || !Number.isFinite(num)) {
    return fallback;
  }
  const intVal = Math.floor(num);
  return Math.max(min, Math.min(max, intVal));
}

/**
 * Validates and sanitizes a URL, strictly blocking `javascript:`, `vbscript:`,
 * and unauthorized data URIs.
 */
export function sanitizeUrl(input: unknown): string | undefined {
  if (!input || typeof input !== 'string') return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    // Block javascript:, data:text/html, etc.
    return undefined;
  } catch {
    // Relative or data URIs
    if (trimmed.startsWith('data:image/') || trimmed.startsWith('/')) {
      return trimmed;
    }
    return undefined;
  }
}

/**
 * Sanitizes user prompts sent to AI LLM to prevent prompt injection payload bloat
 * and token-overflow denial of service.
 */
export function sanitizeAiPrompt(input: unknown, maxLength = 800): string {
  if (!input) return '';
  const str = sanitizeText(input, maxLength);
  return str;
}
