/**
 * Authentication utilities for the wedding website.
 * Uses guest names as the login credential.
 *
 * When the notionBackend feature flag is enabled, validates against Notion.
 * Otherwise, falls back to the hardcoded guest list (for local dev without keys).
 */

import type { GuestRecord } from '../types';
import { normalize } from './normalize';
export type EventInvitation = 'nyc' | 'france';

// Hardcoded fallback guest list for local dev without Notion keys.
// `country` mirrors the Notion Guest List `Country` select so the registry
// split (src/lib/registry-routing.ts) can be exercised locally: the Ancel
// family log in as France-side guests (external MilleMercis registry), the
// Grosses as US-side guests (native Joy registry).
const AUTHORIZED_GUESTS: ReadonlyArray<{ name: string; country: string | null }> = [
  { name: 'Sam Gross', country: 'USA' },
  { name: 'Samuel Gross', country: 'USA' },
  { name: 'Margaux Ancel', country: 'USA' },
  { name: 'Charles Gross', country: 'USA' },
  { name: 'Dorothee Ancel', country: 'FRANCE' },
  { name: 'Nicolas Ancel', country: 'FRANCE' },
  { name: 'Toni Waldman', country: 'USA' },
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

interface SessionPayload {
  guest: string;
  notionId?: string;
  eventInvitations?: EventInvitation[];
  country?: string;
  created: number;
}

/**
 * Create a session token from a guest name and optional Notion ID.
 * For MVP, this is just base64-encoded. In production, use proper signing.
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
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/**
 * Parse and validate a session token.
 * Returns { guest, notionId } if valid, null otherwise.
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
    const payload: SessionPayload = JSON.parse(
      Buffer.from(token, 'base64url').toString('utf-8')
    );

    // Validate the guest name is still recognizable
    if (payload.guest && typeof payload.guest === 'string') {
      const eventInvitations = (payload.eventInvitations || [])
        .filter((event): event is EventInvitation => event === 'nyc' || event === 'france');
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
