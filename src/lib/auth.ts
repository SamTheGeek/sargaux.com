/**
 * Authentication utilities for the wedding website.
 * Uses guest names as the login credential.
 */

// Authorized guests who can access the site
const AUTHORIZED_GUESTS = [
  'Sam Gross',
  'Margaux Ancel',
  'Charles Gross',
  'Dorothee Ancel',
  'Nicolas Ancel',
  'Toni Waldman',
];

/**
 * Normalize a string for comparison:
 * - Convert to lowercase
 * - Remove accent marks (é → e, etc.)
 * - Collapse multiple spaces to single space
 * - Trim leading/trailing whitespace
 */
function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
    .replace(/\s+/g, ' ')
    .trim();
}

// Pre-normalize authorized guests for comparison
const NORMALIZED_GUESTS = AUTHORIZED_GUESTS.map(normalize);

/**
 * Validate a guest name against the authorized list.
 * Returns the canonical name if valid, null otherwise.
 */
export function validateGuest(input: string): string | null {
  const normalizedInput = normalize(input);
  const index = NORMALIZED_GUESTS.indexOf(normalizedInput);

  if (index !== -1) {
    return AUTHORIZED_GUESTS[index];
  }

  return null;
}

/**
 * Cookie name for auth session
 */
export const AUTH_COOKIE_NAME = 'sargaux_auth';

/**
 * Create a session token from a guest name.
 * For MVP, this is just base64-encoded. In production, use proper signing.
 */
export function createSessionToken(guestName: string): string {
  const payload = {
    guest: guestName,
    created: Date.now(),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Parse and validate a session token.
 * Returns the guest name if valid, null otherwise.
 */
export function parseSessionToken(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));

    // Validate the guest name is still in our list
    if (payload.guest && validateGuest(payload.guest)) {
      return payload.guest;
    }
  } catch {
    // Invalid token format
  }

  return null;
}

/**
 * Check if a request has a valid auth cookie.
 * Returns the guest name if authenticated, null otherwise.
 */
export function getAuthenticatedGuest(cookies: { get: (name: string) => { value: string } | undefined }): string | null {
  const cookie = cookies.get(AUTH_COOKIE_NAME);

  if (!cookie?.value) {
    return null;
  }

  return parseSessionToken(cookie.value);
}
