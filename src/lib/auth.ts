/**
 * Authentication utilities for the wedding website.
 * Uses guest names as the login credential.
 *
 * When the notionBackend feature flag is enabled, validates against Notion.
 * Otherwise, falls back to the hardcoded guest list (for local dev without keys).
 *
 * Session cookies are HMAC-signed with SESSION_HMAC_SECRET
 * (format: base64url(payload).hmac — same shape as calendar tokens).
 * Unsigned or tampered cookies fail closed.
 */

import type { GuestRecord } from '../types';
import { normalize } from './normalize';
import { hmacSha256Hex, timingSafeEqualString } from './hmac';
export type EventInvitation = 'nyc' | 'france';

// Synthetic fallback guests for local dev without Notion keys.
// Real guest names live in Notion; do not commit family PII here.
// Country values exercise the registry split (src/lib/registry-routing.ts).
// 'Alex Rivera' + 'Jordan Chen' also exist as a synthetic party in the real
// Notion Guest List, mirroring TEST_GUEST_NAME (tests/fixtures.ts) so the
// same login works in both backend modes without touching real guest data.
// 'Samuel Gross' is the one real name kept (dev login added on main); it
// already appears publicly in site copy, but tests must not use it.
const AUTHORIZED_GUESTS: ReadonlyArray<{ name: string; country: string | null }> = [
  { name: 'Samuel Gross', country: 'USA' },
  { name: 'Alex Rivera', country: 'USA' },
  { name: 'Jordan Chen', country: 'USA' },
  { name: 'Casey Morgan', country: 'USA' },
  { name: 'Riley Dubois', country: 'FRANCE' },
  { name: 'Samir Benoit', country: 'FRANCE' },
  { name: 'Taylor Quinn', country: 'USA' },
];

// Pre-normalize authorized guests for comparison
const NORMALIZED_GUESTS = AUTHORIZED_GUESTS.map((g) => normalize(g.name));

/**
 * Validate a guest name against a list of GuestRecords (Notion-backed).
 * Returns the matching GuestRecord if found, null otherwise.
 */
export function validateGuestFromRecords(
  input: string,
  guests: GuestRecord[]
): GuestRecord | null {
  const normalizedInput = normalize(input);
  return guests.find((g) => g.normalizedName === normalizedInput) || null;
}

/**
 * Validate a guest name against the hardcoded list (fallback).
 * Returns the canonical name if valid, null otherwise.
 */
export function validateGuest(input: string): string | null {
  const normalizedInput = normalize(input);
  const index = NORMALIZED_GUESTS.indexOf(normalizedInput);

  if (index !== -1) {
    return AUTHORIZED_GUESTS[index].name;
  }

  return null;
}

/**
 * Look up the origin country for a hardcoded fallback guest (local dev without
 * Notion). Returns null for unknown names. Mirrors the Country a Notion record
 * would supply so the registry split works when logging in against the
 * hardcoded list.
 */
export function getHardcodedGuestCountry(input: string): string | null {
  const normalizedInput = normalize(input);
  const index = NORMALIZED_GUESTS.indexOf(normalizedInput);
  return index !== -1 ? AUTHORIZED_GUESTS[index].country : null;
}

/**
 * Cookie name for auth session
 */
export const AUTH_COOKIE_NAME = 'sargaux_auth';

/**
 * Session lifetime (90 days) — single source of truth for both the browser
 * cookie maxAge and the server-side token age check in parseSessionToken.
 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

/**
 * Thrown when SESSION_HMAC_SECRET is not configured. Callers must fail closed:
 * no session may ever be minted unsigned. The login endpoint maps this to a 503.
 */
export class SessionSecretMissingError extends Error {
  constructor() {
    super('SESSION_HMAC_SECRET is not set.');
    this.name = 'SessionSecretMissingError';
  }
}

interface SessionPayload {
  guest: string;
  notionId?: string;
  eventInvitations?: EventInvitation[];
  country?: string;
  created: number;
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_HMAC_SECRET;
  if (!secret) {
    throw new SessionSecretMissingError();
  }
  return secret;
}

function computeSessionHmac(payloadB64: string): string {
  return hmacSha256Hex(getSessionSecret(), payloadB64, 32);
}

/**
 * Create a signed session token from a guest name and optional Notion ID.
 * Format: base64url(payload).hmac[0:32]
 */
export function createSessionToken(
  guestName: string,
  notionId?: string,
  eventInvitations?: EventInvitation[],
  country?: string | null
): string {
  const payload: SessionPayload = {
    guest: guestName,
    created: Date.now(),
  };
  if (notionId) {
    payload.notionId = notionId;
  }
  if (eventInvitations && eventInvitations.length > 0) {
    payload.eventInvitations = eventInvitations;
  }
  if (country) {
    payload.country = country;
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = computeSessionHmac(payloadB64);
  return `${payloadB64}.${hmac}`;
}

/**
 * Parse and verify a signed session token.
 * Rejects unsigned (legacy base64-only), tampered, and expired tokens
 * (older than SESSION_MAX_AGE_SECONDS, or with a missing/invalid `created`).
 * Returns { guest, notionId, ... } if valid, null otherwise.
 */
export function parseSessionToken(
  token: string
): {
  guest: string;
  notionId?: string;
  eventInvitations: EventInvitation[];
  country: string | null;
} | null {
  try {
    const dotIndex = token.indexOf('.');
    if (dotIndex === -1) {
      // Unsigned legacy cookie — fail closed
      return null;
    }

    const payloadB64 = token.slice(0, dotIndex);
    const providedHmac = token.slice(dotIndex + 1);
    if (!payloadB64 || !providedHmac) return null;

    let expectedHmac: string;
    try {
      expectedHmac = computeSessionHmac(payloadB64);
    } catch {
      // Missing SESSION_HMAC_SECRET
      return null;
    }

    if (!timingSafeEqualString(providedHmac, expectedHmac)) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf-8')
    );

    // Server-side expiry: browser cookie maxAge alone doesn't invalidate a
    // stolen cookie value. Every signed token is minted by createSessionToken
    // with a numeric `created`, so a missing/invalid one also fails closed.
    if (
      typeof payload.created !== 'number' ||
      !Number.isFinite(payload.created) ||
      Date.now() - payload.created > SESSION_MAX_AGE_MS
    ) {
      return null;
    }

    if (payload.guest && typeof payload.guest === 'string') {
      const eventInvitations = (payload.eventInvitations || []).filter(
        (event): event is EventInvitation => event === 'nyc' || event === 'france'
      );
      return {
        guest: payload.guest,
        notionId: payload.notionId,
        eventInvitations: eventInvitations.length > 0 ? eventInvitations : ['nyc', 'france'],
        country: typeof payload.country === 'string' ? payload.country : null,
      };
    }
  } catch {
    // Invalid token format
  }

  return null;
}

/**
 * Check if a request has a valid auth cookie.
 * Returns { guest, notionId } if authenticated, null otherwise.
 */
export function getAuthenticatedGuest(cookies: {
  get: (name: string) => { value: string } | undefined;
}): {
  guest: string;
  notionId?: string;
  eventInvitations: EventInvitation[];
  country: string | null;
} | null {
  const cookie = cookies.get(AUTH_COOKIE_NAME);

  if (!cookie?.value) {
    return null;
  }

  return parseSessionToken(cookie.value);
}
