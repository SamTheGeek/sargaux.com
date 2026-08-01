import type { APIRoute } from 'astro';
import {
  validateGuestFromRecords,
  getHardcodedGuestRecords,
  createSessionToken,
  createClaimToken,
  parseClaimToken,
  AUTH_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  SessionSecretMissingError,
} from '../../lib/auth';
import { features } from '../../config/features';
import { findGuestByName, findHouseholdByEnvelopeName, getGuestById } from '../../lib/notion';
import { findMatchingHousehold } from '../../lib/envelope-name';
import type { EventInvitation } from '../../lib/auth';
import type { GuestRecord } from '../../types';
import { getPrimaryEventRoute } from '../../lib/event-routing';
import { getDefaultLocale } from '../../lib/locale-routing';
import { checkRateLimit, clientIp, rateLimitResponse } from '../../lib/rate-limit';

/** Strict login rate limit — primary name-enumeration vector. */
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Redeeming an identity claim gets its own bucket. It is not an enumeration
 * vector — the claim already names the only IDs it can be redeemed for — and
 * charging it to the login bucket would make every two-step login cost two of
 * the ten attempts.
 */
const CLAIM_LIMIT = 20;
const CLAIM_WINDOW_MS = 15 * 60 * 1000;

interface ResolvedGuest {
  name: string;
  notionId?: string;
  eventInvitations: EventInvitation[];
  country: string | null;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function toResolvedGuest(record: GuestRecord): ResolvedGuest {
  return {
    name: record.name,
    // Synthetic fallback records have no Notion page; leaving notionId unset
    // keeps the session out of the Notion-bound middleware path.
    notionId: record.id.startsWith('fallback:') ? undefined : record.id,
    eventInvitations: record.eventInvitations,
    country: record.country ?? null,
  };
}

/** Look up a guest by page ID, from Notion or the hardcoded fallback list. */
async function resolveGuestById(guestId: string): Promise<ResolvedGuest | null> {
  if (features.global.notionBackend && !guestId.startsWith('fallback:')) {
    const record = await getGuestById(guestId);
    return record ? toResolvedGuest(record) : null;
  }
  const record = getHardcodedGuestRecords().find((guest) => guest.id === guestId);
  return record ? toResolvedGuest(record) : null;
}

/**
 * Resolve a typed name to the guests it identifies.
 *
 * Exact `Full Name` still wins and still returns a single guest, so the
 * long-standing one-step login is untouched. Only when that misses do we try
 * the envelope name / first-name-combination rules, which may name a whole
 * household.
 */
async function resolveByName(name: string): Promise<GuestRecord[]> {
  if (features.global.notionBackend) {
    try {
      const exact = await findGuestByName(name);
      if (exact) return [exact];

      if (!features.global.envelopeLogin) return [];

      const household = await findHouseholdByEnvelopeName(name);
      if (household) return household;
    } catch (err) {
      // Notion unreachable or unconfigured — fall through to the hardcoded
      // list, which runs the same exact-then-envelope sequence below.
      console.error('Notion fetch failed, falling back to hardcoded list:', err);
      return resolveFromHardcodedList(name);
    }
    return [];
  }

  return resolveFromHardcodedList(name);
}

/** Exact name, then envelope rules, against the hardcoded fallback guests. */
function resolveFromHardcodedList(name: string): GuestRecord[] {
  const records = getHardcodedGuestRecords();

  // Full Name then invitation title — the same matcher the Notion path uses,
  // so both backend modes accept exactly the same set of typed names.
  const exact = validateGuestFromRecords(name, records);
  if (exact) return [exact];

  if (!features.global.envelopeLogin) return [];

  const memberIds = findMatchingHousehold(name, records, (matches) => {
    console.warn(
      `Envelope-name login is ambiguous for ${JSON.stringify(name)} — matched ${matches.length} households:`,
      matches
    );
  });
  if (!memberIds) return [];
  return records.filter((guest) => memberIds.includes(guest.id));
}

/** Mint the session cookie and build the success response. */
function completeLogin(
  guest: ResolvedGuest,
  cookies: Parameters<APIRoute>[0]['cookies']
): Response {
  let token: string;
  try {
    token = createSessionToken(guest.name, guest.notionId, guest.eventInvitations, guest.country);
  } catch (err) {
    if (err instanceof SessionSecretMissingError) {
      console.error(
        'Login unavailable: SESSION_HMAC_SECRET is not set, so session cookies cannot be signed. Set it in the runtime environment (Netlify Dashboard / .env.local).'
      );
      return json({ error: 'Login is temporarily unavailable. Please try again later.' }, 503);
    }
    throw err;
  }

  const redirectPath = getPrimaryEventRoute(guest.eventInvitations);

  cookies.set(AUTH_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS, // 90 days — matches server-side expiry in parseSessionToken
  });

  // Default the site language from the guest's country, but never clobber a
  // language the guest (or a previous session) already chose explicitly.
  if (features.global.i18n && !cookies.has('sargaux_lang')) {
    cookies.set('sargaux_lang', getDefaultLocale(guest.country), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      httpOnly: false,
      sameSite: 'lax',
    });
  }

  return json({ success: true, guest: guest.name, redirectPath }, 200);
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const ip = clientIp(request);
  const formData = await request.formData();
  const claim = formData.get('claim');
  const guestId = formData.get('guestId');

  // ── Step 2: redeem an identity claim ──────────────────────────────────────
  if (typeof claim === 'string' && claim) {
    const claimLimit = checkRateLimit(`claim:${ip}`, CLAIM_LIMIT, CLAIM_WINDOW_MS);
    if (!claimLimit.ok) return rateLimitResponse(claimLimit.retryAfterSec);

    const parsed = parseClaimToken(claim);
    if (!parsed || typeof guestId !== 'string' || !parsed.memberIds.includes(guestId)) {
      // Expired, tampered, or aimed at someone outside the household. The
      // client restores the name field so the guest can simply start over.
      return json({ error: 'That took too long. Please enter your name again.', claimExpired: true }, 401);
    }

    const guest = await resolveGuestById(guestId);
    if (!guest) {
      return json({ error: 'Name not found, it must match exactly.' }, 401);
    }

    return completeLogin(guest, cookies);
  }

  // ── Step 1: resolve a typed name ──────────────────────────────────────────
  const limit = checkRateLimit(`login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!limit.ok) return rateLimitResponse(limit.retryAfterSec);

  const name = formData.get('name');

  if (typeof name !== 'string' || !name.trim()) {
    return json({ error: 'Please enter your name' }, 400);
  }

  const matches = await resolveByName(name);

  if (matches.length === 0) {
    // Small constant delay to blunt timing/volume enumeration (best-effort)
    await new Promise((r) => setTimeout(r, 200));
    return json({ error: 'Name not found, it must match exactly.' }, 401);
  }

  // One person named — log them straight in, same as a full-name login.
  if (matches.length === 1) {
    return completeLogin(toResolvedGuest(matches[0]), cookies);
  }

  // The name identifies an envelope, not a person. Ask who they are before
  // minting anything, so the RSVP is attributed to the right guest. No cookie
  // is set here; the claim is what authorizes the follow-up request.
  let claimToken: string;
  try {
    claimToken = createClaimToken(matches.map((guest) => guest.id));
  } catch (err) {
    if (err instanceof SessionSecretMissingError) {
      console.error(
        'Login unavailable: SESSION_HMAC_SECRET is not set, so identity claims cannot be signed.'
      );
      return json({ error: 'Login is temporarily unavailable. Please try again later.' }, 503);
    }
    throw err;
  }

  return json(
    {
      needsIdentity: true,
      claim: claimToken,
      candidates: matches.map((guest) => ({ id: guest.id, name: guest.name })),
    },
    200
  );
};
