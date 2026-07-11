/**
 * Security regression tests for session forgery, RSVP payload validation,
 * ops endpoint lockdown, and related hardening.
 */

import { test, expect } from '@playwright/test';
import { createSessionToken, parseSessionToken } from '../src/lib/auth';
import { TEST_GUEST_NAME } from './fixtures';

const notionRequired =
  process.env.FEATURE_GLOBAL_NOTION_BACKEND !== 'true' ||
  !process.env.NOTION_API_KEY ||
  !process.env.NOTION_GUEST_LIST_DB;

test.describe('Security — Session tokens', () => {
  test('unsigned legacy cookies are rejected by parseSessionToken', () => {
    const unsigned = Buffer.from(
      JSON.stringify({ guest: 'Forged Guest', notionId: 'fake-id', created: Date.now() })
    ).toString('base64url');
    expect(parseSessionToken(unsigned)).toBeNull();
  });

  test('unsigned cookie cannot access protected routes', async ({ request }) => {
    const unsigned = Buffer.from(
      JSON.stringify({
        guest: 'Forged Guest',
        eventInvitations: ['nyc', 'france'],
        created: Date.now(),
      })
    ).toString('base64url');

    const response = await request.get('/nyc', {
      headers: { Cookie: `sargaux_auth=${unsigned}` },
      maxRedirects: 0,
    });
    // Middleware redirects unauthenticated users to /
    expect([302, 303, 307]).toContain(response.status());
    expect(response.headers()['location']).toMatch(/\/$/);
  });

  test('tampered HMAC cookie is rejected', async ({ request }) => {
    const token = createSessionToken('Forged Guest', undefined, ['nyc']);
    const [payloadB64] = token.split('.');
    const tampered = `${payloadB64}.ffffffffffffffffffffffffffffffff`;

    const response = await request.get('/nyc', {
      headers: { Cookie: `sargaux_auth=${tampered}` },
      maxRedirects: 0,
    });
    expect([302, 303, 307]).toContain(response.status());
  });
});

test.describe('Security — RSVP hardening', () => {
  test.skip(notionRequired, 'Notion backend required');
  test.describe.configure({ mode: 'serial' });

  let authCookie: string | undefined;
  let guestNotionId: string | undefined;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/');
    await page.click('#login-trigger');
    await page.fill('#name', TEST_GUEST_NAME);
    await page.press('#name', 'Enter');
    await page.waitForURL(/\/nyc$/);

    const cookies = await context.cookies();
    authCookie = cookies.find((c) => c.name === 'sargaux_auth')?.value;
    if (authCookie) {
      const parsed = parseSessionToken(authCookie);
      guestNotionId = parsed?.notionId;
    }

    await context.close();
    expect(authCookie).toBeTruthy();
    expect(guestNotionId).toBeTruthy();
  });

  test('forged cookie with stolen notionId + wrong name cannot RSVP', async ({ request }) => {
    // Simulate calendar-token leak: attacker has a real notionId but arbitrary display name
    const forged = createSessionToken('Attacker Name', guestNotionId, ['nyc', 'france']);

    const response = await request.post('/api/rsvp', {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sargaux_auth=${forged}`,
      },
      data: {
        event: 'nyc',
        guestsAttending: [{ name: 'Attacker Name', attending: true }],
        eventsAttending: [],
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Invalid session');
    expect(body.details).toBeUndefined();
  });

  test('foreign guestsAttending name is rejected', async ({ request }) => {
    const response = await request.post('/api/rsvp', {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sargaux_auth=${authCookie}`,
      },
      data: {
        event: 'nyc',
        guestsAttending: [
          { name: TEST_GUEST_NAME, attending: true },
          { name: 'Totally Fake Guest', attending: true },
        ],
        eventsAttending: [],
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/outside this party/i);
  });

  test('invalid eventsAttending ID is rejected', async ({ request }) => {
    const response = await request.post('/api/rsvp', {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sargaux_auth=${authCookie}`,
      },
      data: {
        event: 'nyc',
        guestsAttending: [{ name: TEST_GUEST_NAME, attending: true }],
        eventsAttending: ['not-a-real-event-id-0000'],
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/invalid event/i);
  });

  test('oversized details blob is rejected', async ({ request }) => {
    const response = await request.post('/api/rsvp', {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sargaux_auth=${authCookie}`,
      },
      data: {
        event: 'nyc',
        guestsAttending: [{ name: TEST_GUEST_NAME, attending: true }],
        eventsAttending: [],
        details: { blob: 'x'.repeat(10_000) },
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/too large/i);
  });
});

test.describe('Security — Ops endpoints', () => {
  test('GET /api/warm requires admin Bearer', async ({ request }) => {
    const response = await request.get('/api/warm');
    expect(response.status()).toBe(401);
  });

  test('GET /api/warm succeeds with admin secret', async ({ request }) => {
    test.skip(notionRequired, 'Notion backend required');
    const secret = process.env.RESEND_ADMIN_SECRET ?? 'test-secret-not-set';
    const response = await request.get('/api/warm', {
      headers: { Authorization: `Bearer ${secret}` },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.warmed).toBe(true);
    expect(body.guestCount).toBeUndefined();
  });

  test('GET /api/calendar/health returns only ok flag', async ({ request }) => {
    const response = await request.get('/api/calendar/health');
    const body = await response.json();
    expect(body).toEqual({ ok: expect.any(Boolean) });
    expect(body.hasSecret).toBeUndefined();
    expect(body.hasNotionKey).toBeUndefined();
    expect(body.blobsOk).toBeUndefined();
  });
});
