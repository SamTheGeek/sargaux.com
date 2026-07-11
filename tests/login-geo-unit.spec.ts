import { test, expect } from '@playwright/test';
import {
  ALLOWED_LOGIN_COUNTRIES,
  gateLoginByCountry,
} from '../netlify/edge-functions/login-geo-gate';

/**
 * Unit-style tests for the login geo-gate edge function's pure logic. These
 * run in the Playwright Node context (not the browser), following the pattern
 * of auth-unit.spec.ts / rate-limit-unit.spec.ts.
 *
 * The gate itself only runs on Netlify's edge (Deno) — the local node-adapter
 * server never sees it — but the country decision is a pure function, so it
 * is directly importable and testable here. The `@netlify/edge-functions`
 * import in the module is type-only and erased at transpile time.
 */

test.describe('Login geo gate — allowlist contents', () => {
  test('includes the expected regions', () => {
    for (const code of ['US', 'CA', 'GB', 'IE', 'FR', 'DE', 'CH', 'MC', 'BR', 'AR', 'JP', 'TW', 'IN']) {
      expect(ALLOWED_LOGIN_COUNTRIES.has(code)).toBe(true);
    }
  });

  test('excludes non-allowlisted countries', () => {
    for (const code of ['RU', 'CN', 'NG', 'AU', 'MX']) {
      expect(ALLOWED_LOGIN_COUNTRIES.has(code)).toBe(false);
    }
  });
});

test.describe('Login geo gate — gateLoginByCountry', () => {
  test('allowed country passes through (returns undefined)', () => {
    expect(gateLoginByCountry('US')).toBeUndefined();
    expect(gateLoginByCountry('FR')).toBeUndefined();
  });

  test('country code matching is case-insensitive', () => {
    expect(gateLoginByCountry('us')).toBeUndefined();
    expect(gateLoginByCountry('fr')).toBeUndefined();
  });

  test('blocked country gets a 403 with the login error JSON shape', async () => {
    const response = gateLoginByCountry('RU');
    expect(response).toBeDefined();
    expect(response!.status).toBe(403);
    expect(response!.headers.get('Content-Type')).toBe('application/json');

    const body = await response!.json();
    expect(body).toEqual({ error: 'Login is not available from your region.' });
  });

  test('missing geo data fails open', () => {
    expect(gateLoginByCountry(undefined)).toBeUndefined();
    expect(gateLoginByCountry(null)).toBeUndefined();
    expect(gateLoginByCountry('')).toBeUndefined();
  });
});
