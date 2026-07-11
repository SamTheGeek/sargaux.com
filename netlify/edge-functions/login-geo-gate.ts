import type { Config, Context } from '@netlify/edge-functions';

/**
 * Geo allowlist for `POST /api/login` — an explicit request from the site
 * owners: guests browse from a limited set of places, and "people off the
 * beaten path will understand." This gate covers ONLY the login endpoint;
 * page browsing is deliberately NOT geo-blocked, both to protect per-guest
 * CDN caching (edge functions in front of cached pages would bypass the CDN
 * cache) and to keep the site readable for traveling guests and link-preview
 * fetchers. Do not widen the `path` below.
 *
 * Countries where guests plausibly log in from: US/Canada, UK/Ireland,
 * mainland Europe (EU 27 + CH/NO/IS/LI and the microstates MC/AD/SM/VA),
 * plus Brazil, Argentina, Japan, Taiwan, and India.
 */
export const ALLOWED_LOGIN_COUNTRIES: ReadonlySet<string> = new Set([
  // North America
  'US', 'CA',
  // UK + Ireland
  'GB', 'IE',
  // EU members
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI',
  'ES', 'SE',
  // Non-EU mainland Europe + microstates
  'CH', 'NO', 'IS', 'LI', 'MC', 'AD', 'SM', 'VA',
  // Rest of world
  'BR', 'AR', 'JP', 'TW', 'IN',
]);

/**
 * Pure gate logic, kept separately exportable so tests/login-geo-unit.spec.ts
 * can import it under Node without the Deno edge runtime.
 *
 * Returns a 403 Response for blocked countries, or undefined to pass the
 * request through. Missing geo data FAILS OPEN — never lock a guest out
 * because the platform couldn't resolve their location.
 */
export function gateLoginByCountry(
  countryCode: string | null | undefined
): Response | undefined {
  if (!countryCode) return undefined;
  if (ALLOWED_LOGIN_COUNTRIES.has(countryCode.toUpperCase())) return undefined;

  // Matches the login endpoint's error shape (see src/pages/api/login.ts).
  return new Response(
    JSON.stringify({ error: 'Login is not available from your region.' }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

export default function handler(_request: Request, context: Context) {
  return gateLoginByCountry(context.geo?.country?.code);
}

export const config: Config = {
  path: '/api/login',
};
