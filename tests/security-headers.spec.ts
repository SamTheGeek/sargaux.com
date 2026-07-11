/**
 * Security header regression tests (audit P1-5).
 *
 * The headers are set by src/middleware.ts on every non-API page response —
 * NOT by netlify.toml, whose [[headers]] rules never apply to function
 * responses (i.e. all SSR pages under the Netlify adapter). Because the
 * middleware owns them, these assertions hold under the node adapter used by
 * the Playwright web server.
 */

import { test, expect, type APIResponse } from '@playwright/test';
import { createSessionToken } from '../src/lib/auth';

const BASE_URL = 'http://localhost:1213';

const EXPECTED_CSP_REPORT_ONLY =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'";

function expectSecurityHeaders(response: APIResponse): void {
  const headers = response.headers();
  expect(headers['x-frame-options']).toBe('SAMEORIGIN');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toBe(
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  expect(headers['content-security-policy-report-only']).toBe(
    EXPECTED_CSP_REPORT_ONLY
  );
  // Report-only, never enforcing — enforcement waits on a reporting endpoint.
  expect(headers['content-security-policy']).toBeUndefined();
}

test.describe('Security headers on SSR responses', () => {
  test('logged-out homepage carries security headers', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/`);
    expect(response.status()).toBe(200);
    expectSecurityHeaders(response);
  });

  test('unauthenticated redirect from protected route carries security headers', async ({
    request,
  }) => {
    const response = await request.get(`${BASE_URL}/nyc`, {
      maxRedirects: 0,
    });
    expect([302, 303, 307]).toContain(response.status());
    expect(response.headers()['location']).toMatch(/\/$/);
    expectSecurityHeaders(response);
  });

  test('authenticated protected page carries security headers', async ({
    request,
  }) => {
    const token = createSessionToken('Header Test Guest', undefined, ['nyc']);

    const response = await request.get(`${BASE_URL}/nyc`, {
      headers: { Cookie: `sargaux_auth=${token}` },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(200);
    expectSecurityHeaders(response);
  });

  test('API routes are not given page security headers', async ({ request }) => {
    // Middleware scopes the headers to page responses, matching the
    // Netlify-Vary code path — API responses stay untouched. Health may be
    // 503 locally (no Netlify Blobs under the node adapter) — either way the
    // response went through middleware, which is all this test needs.
    const response = await request.get(`${BASE_URL}/api/calendar/health`);
    expect([200, 503]).toContain(response.status());
    const headers = response.headers();
    expect(headers['x-frame-options']).toBeUndefined();
    expect(headers['content-security-policy-report-only']).toBeUndefined();
  });
});
