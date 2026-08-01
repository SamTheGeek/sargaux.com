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
// `household` groups guests the way the Notion `Related Guests` relation does,
// and `envelopeNames` stands in for the Notion `Envelope Names` property, so
// envelope-name login works with the notionBackend flag off. Never add real
// guest names or real envelope strings here.
interface FallbackGuest {
  name: string;
  country: string | null;
  firstName: string;
  lastName: string;
  /** Shared id for everyone on one envelope; unique when they live alone. */
  household: string;
  /** Envelope strings this household received, when not derivable from names. */
  envelopeNames?: string[];
  /**
   * The name printed on the invitation, when it differs from `name` (the
   * Notion `Full Name` equivalent). Stands in for the `Name of Guest` title so
   * the invitation-title login fallback is exercised with the flag off too.
   */
  invitationTitle?: string;
}

const AUTHORIZED_GUESTS: ReadonlyArray<FallbackGuest> = [
  { name: 'Samuel Gross', country: 'USA', firstName: 'Samuel', lastName: 'Gross', household: 'gross' },
  {
    name: 'Alex Rivera',
    country: 'USA',
    firstName: 'Alex',
    lastName: 'Rivera',
    household: 'rivera-chen',
    envelopeNames: ['Alex Rivera & Jordan Chen', 'The Rivera Family'],
  },
  {
    name: 'Jordan Chen',
    country: 'USA',
    firstName: 'Jordan',
    lastName: 'Chen',
    household: 'rivera-chen',
    envelopeNames: ['Alex Rivera & Jordan Chen', 'The Rivera Family'],
  },
  { name: 'Casey Morgan', country: 'USA', firstName: 'Casey', lastName: 'Morgan', household: 'morgan' },
  { name: 'Riley Dubois', country: 'FRANCE', firstName: 'Riley', lastName: 'Dubois', household: 'dubois' },
  { name: 'Samir Benoit', country: 'FRANCE', firstName: 'Samir', lastName: 'Benoit', household: 'benoit' },
  { name: 'Taylor Quinn', country: 'USA', firstName: 'Taylor', lastName: 'Quinn', household: 'quinn' },
  // Nickname on the invitation, legal name in Notion — the ~10% of the real
  // guest list whose printed name never matched `Full Name` before the
  // invitation-title fallback existed.
  {
    name: 'Frederica Okonkwo',
    country: 'USA',
    firstName: 'Frederica',
    lastName: 'Okonkwo',
    household: 'okonkwo',
    invitationTitle: 'Freddie Okonkwo',
  },
];

/**
 * The hardcoded list shaped as GuestRecords, so envelope matching runs through
 * exactly the same code path in both backend modes. Ids are synthetic and stable
 * (`fallback:<name>`), and never collide with Notion page IDs.
 */
export function getHardcodedGuestRecords(): GuestRecord[] {
  const idFor = (guest: FallbackGuest) => `fallback:${normalize(guest.name).replace(/\s+/g, '-')}`;

  return AUTHORIZED_GUESTS.map((guest) => ({
    id: idFor(guest),
    name: guest.name,
    normalizedName: normalize(guest.name),
    eventInvitations: ['nyc', 'france'] as EventInvitation[],
    country: guest.country,
    isPlusOne: false,
    relatedGuestIds: AUTHORIZED_GUESTS.filter(
      (other) => other.household === guest.household && other.name !== guest.name
    ).map(idFor),
    firstName: guest.firstName,
    lastName: guest.lastName,
    envelopeNames: guest.envelopeNames,
    invitationTitle: guest.invitationTitle ?? guest.name,
  }));
}

// Pre-normalize authorized guests for comparison
const NORMALIZED_GUESTS = AUTHORIZED_GUESTS.map((g) => normalize(g.name));

/**
 * Validate a guest name against a list of GuestRecords (Notion-backed).
 * Returns the matching GuestRecord if found, null otherwise.
 *
 * Two passes, in order:
 *
 *  1. `Full Name` (the formula `First Name + " " + Last Name`) — the canonical
 *     identity, and the only thing login matched historically.
 *  2. `Name of Guest` (the invitation title) — the name actually *printed* on
 *     the envelope, and therefore the one a guest is most likely to type.
 *
 * The second pass exists because the two disagree for ~10% of the guest list:
 * nickname/legal-name pairs, accent and spelling variants, and records where a
 * name part was mistyped or left blank. Without it, one bad cell in Notion
 * locks a guest out of the site with no recourse — the failure mode this was
 * written for was a guest whose surname was wrong in `Last Name`, which broke
 * both exact matching *and* the envelope-name rules (those check the typed
 * surname against the household's, see src/lib/envelope-name.ts).
 *
 * Full Name is deliberately checked first and across the whole list, so this
 * can never change the result for a guest who already logs in today. A title
 * shared by two records fails closed rather than guessing between them.
 */
export function validateGuestFromRecords(
  input: string,
  guests: GuestRecord[]
): GuestRecord | null {
  const normalizedInput = normalize(input);

  const byFullName = guests.find((g) => g.normalizedName === normalizedInput);
  if (byFullName) return byFullName;

  const byTitle = guests.filter(
    (g) => g.invitationTitle && normalize(g.invitationTitle) === normalizedInput
  );
  return byTitle.length === 1 ? byTitle[0] : null;
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

// ── Identity claim tokens ───────────────────────────────────────────────────
//
// When a login name resolves to a household rather than one person, the server
// hands back a short-lived claim listing that household's member IDs. The guest
// picks who they are and posts the claim back, and only then is a session
// minted. The claim is what authorizes the second step — and because the server
// put the member IDs in it, a leaked claim can never be pointed at an arbitrary
// guest, only at someone already on that envelope.
//
// Signed with SESSION_HMAC_SECRET; the `typ` field domain-separates claims from
// session tokens, so no additional secret has to be provisioned.

/** Claims are for finishing a login in progress, not for holding a session. */
const CLAIM_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

interface ClaimPayload {
  typ: 'claim';
  memberIds: string[];
  created: number;
}

/** Create a signed identity claim over a household's member IDs. */
export function createClaimToken(memberIds: string[]): string {
  const payload: ClaimPayload = {
    typ: 'claim',
    memberIds,
    created: Date.now(),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${payloadB64}.${computeSessionHmac(payloadB64)}`;
}

/**
 * Verify a claim token and return the member IDs it authorizes.
 * Rejects unsigned, tampered, expired, and non-claim (e.g. session) tokens.
 */
export function parseClaimToken(token: string): { memberIds: string[] } | null {
  try {
    const dotIndex = token.indexOf('.');
    if (dotIndex === -1) return null;

    const payloadB64 = token.slice(0, dotIndex);
    const providedHmac = token.slice(dotIndex + 1);
    if (!payloadB64 || !providedHmac) return null;

    let expectedHmac: string;
    try {
      expectedHmac = computeSessionHmac(payloadB64);
    } catch {
      return null; // Missing SESSION_HMAC_SECRET — fail closed
    }

    if (!timingSafeEqualString(providedHmac, expectedHmac)) return null;

    const payload: ClaimPayload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf-8')
    );

    // A validly-signed session token must never be redeemable as a claim
    if (payload.typ !== 'claim') return null;

    if (
      typeof payload.created !== 'number' ||
      !Number.isFinite(payload.created) ||
      Date.now() - payload.created > CLAIM_MAX_AGE_MS
    ) {
      return null;
    }

    if (!Array.isArray(payload.memberIds) || payload.memberIds.length === 0) return null;
    if (!payload.memberIds.every((id) => typeof id === 'string' && id.length > 0)) return null;

    return { memberIds: payload.memberIds };
  } catch {
    return null;
  }
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
