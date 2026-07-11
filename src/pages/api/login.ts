import type { APIRoute } from 'astro';
import {
  validateGuest,
  getHardcodedGuestCountry,
  createSessionToken,
  AUTH_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  SessionSecretMissingError,
} from '../../lib/auth';
import { features } from '../../config/features';
import { findGuestByName } from '../../lib/notion';
import type { EventInvitation } from '../../lib/auth';
import { getPrimaryEventRoute } from '../../lib/event-routing';
import { getDefaultLocale } from '../../lib/locale-routing';
import { checkRateLimit, clientIp, rateLimitResponse } from '../../lib/rate-limit';

/** Strict login rate limit — primary name-enumeration vector. */
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const POST: APIRoute = async ({ request, cookies }) => {
  const ip = clientIp(request);
  const limit = checkRateLimit(`login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!limit.ok) return rateLimitResponse(limit.retryAfterSec);

  const formData = await request.formData();
  const name = formData.get('name');

  if (typeof name !== 'string' || !name.trim()) {
    return new Response(JSON.stringify({ error: 'Please enter your name' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let guestName: string | null = null;
  let notionId: string | undefined;
  let eventInvitations: EventInvitation[] = ['nyc', 'france'];
  let country: string | null = null;

  if (features.global.notionBackend) {
    try {
      const record = await findGuestByName(name);
      if (record) {
        guestName = record.name;
        notionId = record.id;
        eventInvitations = record.eventInvitations;
        country = record.country;
      }
    } catch (err) {
      console.error('Notion fetch failed, falling back to hardcoded list:', err);
      guestName = validateGuest(name);
      country = getHardcodedGuestCountry(name);
    }
  } else {
    guestName = validateGuest(name);
    country = getHardcodedGuestCountry(name);
  }

  if (!guestName) {
    // Small constant delay to blunt timing/volume enumeration (best-effort)
    await new Promise((r) => setTimeout(r, 200));
    return new Response(
      JSON.stringify({
        error: 'Name not found, it must match exactly.',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Create session token and set cookie. Sessions are never minted unsigned —
  // if the signing secret is missing, login is unavailable (503), not broken (500).
  let token: string;
  try {
    token = createSessionToken(guestName, notionId, eventInvitations, country);
  } catch (err) {
    if (err instanceof SessionSecretMissingError) {
      console.error(
        'Login unavailable: SESSION_HMAC_SECRET is not set, so session cookies cannot be signed. Set it in the runtime environment (Netlify Dashboard / .env.local).'
      );
      return new Response(
        JSON.stringify({ error: 'Login is temporarily unavailable. Please try again later.' }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    throw err;
  }
  const redirectPath = getPrimaryEventRoute(eventInvitations);

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
    cookies.set('sargaux_lang', getDefaultLocale(country), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      httpOnly: false,
      sameSite: 'lax',
    });
  }

  // Return success with the canonical guest name
  return new Response(JSON.stringify({ success: true, guest: guestName, redirectPath }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
