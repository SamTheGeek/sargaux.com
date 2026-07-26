/**
 * RSVP API endpoint tests
 *
 * Tests for /api/rsvp POST, GET, and DELETE endpoints
 *
 * NOTE: These tests require:
 * - Notion backend enabled (FEATURE_GLOBAL_NOTION_BACKEND=true)
 * - Valid NOTION_API_KEY, NOTION_GUEST_LIST_DB, NOTION_RSVP_RESPONSES_DB env vars
 * - The synthetic test guest (TEST_GUEST_NAME, see fixtures.ts) exists in the
 *   Notion Guest List database as a party of two invited to both weddings
 *
 * Skip these tests if Notion backend is not configured.
 */

import { test, expect } from '@playwright/test';
import { TEST_GUEST_NAME } from './fixtures';

test.describe('RSVP API Endpoints', () => {
  // Run tests serially — they write to shared Notion state (the synthetic
  // test party's RSVPs) and must not run in parallel with each other.
  test.describe.configure({ mode: 'serial' });

  let authCookie: string | undefined;
  let partyGuestIds: string[] = [];
  let nycEventIds: string[] = [];

  // Skip all tests if Notion backend is not enabled
  // This is detected by checking if the login redirects to /nyc (Notion enabled) or stays on / (hardcoded list)
  test.skip(
    !process.env.FEATURE_GLOBAL_NOTION_BACKEND ||
      process.env.FEATURE_GLOBAL_NOTION_BACKEND !== 'true',
    'Notion backend not configured'
  );

  test.beforeAll(async ({ playwright }) => {
    // Login once via the API to get the auth cookie — a form POST needs no
    // browser. The request context keeps the cookie for subsequent calls.
    const context = await playwright.request.newContext({
      baseURL: 'http://127.0.0.1:1213',
    });

    const loginResponse = await context.post('/api/login', {
      form: { name: TEST_GUEST_NAME },
    });
    expect(loginResponse.status()).toBe(200);

    const { cookies } = await context.storageState();
    authCookie = cookies.find((c) => c.name === 'sargaux_auth')?.value;
    expect(authCookie).toBeTruthy();

    // Send the cookie explicitly on every request: the auth cookie is Secure,
    // and the request-context jar refuses to attach Secure cookies over plain
    // http://127.0.0.1 (unlike a real browser, which trusts localhost).
    const authHeaders = { Cookie: `sargaux_auth=${authCookie}` };

    // The party's guest IDs are rendered as data-guest-email-id attributes on
    // the RSVP form — extract them from the server-rendered HTML. Anchor the
    // match to <input tags: the page's inline script also contains the literal
    // text data-guest-email-id="${...}" inside a querySelector template.
    const rsvpPage = await context.get('/nyc/rsvp', { headers: authHeaders });
    expect(rsvpPage.status()).toBe(200);
    const html = await rsvpPage.text();
    partyGuestIds = [
      ...html.matchAll(/<input[^>]*data-guest-email-id="([^"]+)"/g),
    ].map((match) => match[1]);
    expect(partyGuestIds.length).toBeGreaterThan(0);

    // The NYC event catalog ids come from the form's per-event dropdowns —
    // submissions that mean "attending" must name at least one event, since
    // an empty eventsAttending is treated as a decline for the whole party.
    nycEventIds = [
      ...html.matchAll(/<select[^>]*data-event-id="([^"]+)"/g),
    ].map((match) => match[1]);
    expect(nycEventIds.length).toBeGreaterThan(0);

    // Clean up any existing RSVPs for the test guest to ensure a clean slate.
    // Loop until all RSVPs are deleted (there may be multiple from prior test runs).
    for (const event of ['nyc', 'france'] as const) {
      for (let i = 0; i < 10; i++) {
        const r = await context.delete(`/api/rsvp?event=${event}`, {
          headers: authHeaders,
        });
        if (r.status() !== 200) break; // 404 = none left, stop
      }
    }

    await context.dispose();

    expect(authCookie).toBeTruthy();
  });

  test('POST /api/rsvp - requires authentication', async ({ request }) => {
    const response = await request.post(`/api/rsvp`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        event: 'nyc',
        guestsAttending: [{ name: TEST_GUEST_NAME, attending: true }],
        eventsAttending: [],
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('POST /api/rsvp - validates event field', async ({ request }) => {
    const response = await request.post(`/api/rsvp`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sargaux_auth=${authCookie}`,
      },
      data: {
        event: 'invalid',
        guestsAttending: [{ name: TEST_GUEST_NAME, attending: true }],
        eventsAttending: [],
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid event');
  });

  test('POST /api/rsvp - validates guestsAttending array', async ({ request }) => {
    const response = await request.post(`/api/rsvp`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sargaux_auth=${authCookie}`,
      },
      data: {
        event: 'nyc',
        guestsAttending: 'not an array',
        eventsAttending: [],
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('guestsAttending must be an array');
  });

  test('POST /api/rsvp - requires at least one email when confirmation is requested', async ({ request }) => {
    const response = await request.post(`/api/rsvp`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sargaux_auth=${authCookie}`,
      },
      data: {
        event: 'nyc',
        guestsAttending: [{ name: TEST_GUEST_NAME, attending: true }],
        guestEmails: partyGuestIds.map((guestId) => ({ guestId, name: TEST_GUEST_NAME, email: '' })),
        eventsAttending: [],
        sendConfirmation: true,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('At least one email address is required');
  });

  test('POST /api/rsvp - submits new RSVP successfully', async ({ request }) => {
    // First, delete ALL existing NYC RSVPs to ensure a clean state
    for (let i = 0; i < 10; i++) {
      const r = await request.delete(`/api/rsvp?event=nyc`, {
        headers: { Cookie: `sargaux_auth=${authCookie}` },
      });
      if (r.status() !== 200) break;
    }

    // Submit new RSVP
    const response = await request.post(`/api/rsvp`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sargaux_auth=${authCookie}`,
      },
      data: {
        event: 'nyc',
        guestsAttending: [{ name: TEST_GUEST_NAME, attending: true }],
        eventsAttending: [],
        dietary: 'Vegetarian',
        message: 'Excited to celebrate!',
        details: {},
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.responseId).toBeTruthy();
  });

  test('POST /api/rsvp - updates existing RSVP', async ({ request }) => {
    // Submit initial RSVP
    const response1 = await request.post(`/api/rsvp`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sargaux_auth=${authCookie}`,
      },
      data: {
        event: 'nyc',
        guestsAttending: [{ name: TEST_GUEST_NAME, attending: true }],
        eventsAttending: [],
        dietary: 'None',
      },
    });

    expect(response1.status()).toBe(200);
    const body1 = await response1.json();
    const responseId1 = body1.responseId;

    // Update the RSVP
    const response2 = await request.post(`/api/rsvp`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sargaux_auth=${authCookie}`,
      },
      data: {
        event: 'nyc',
        guestsAttending: [{ name: TEST_GUEST_NAME, attending: false }],
        eventsAttending: [],
        dietary: 'Vegan',
      },
    });

    expect(response2.status()).toBe(200);
    const body2 = await response2.json();
    const responseId2 = body2.responseId;

    // Same response ID means it updated, not created new
    expect(responseId2).toBe(responseId1);
  });

  test('POST /api/rsvp - declining every event records a decline even when guest toggles stay checked', async ({
    request,
  }) => {
    // The form's guest toggles default to checked; a guest who declines by
    // answering "Not attending" to every event dropdown never touches them.
    // That submission arrives as attending guests + zero events, and must be
    // stored as a decline, not as Attending.
    const response = await request.post(`/api/rsvp`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sargaux_auth=${authCookie}`,
      },
      data: {
        event: 'nyc',
        guestsAttending: [{ name: TEST_GUEST_NAME, attending: true }],
        eventsAttending: [],
      },
    });
    expect(response.status()).toBe(200);

    const getRes = await request.get(`/api/rsvp?event=nyc`, {
      headers: { Cookie: `sargaux_auth=${authCookie}` },
    });
    expect(getRes.status()).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.rsvp?.status).toBe('Declined');
    expect(getBody.rsvp?.guestsAttending ?? '').toBe('');
    expect(getBody.rsvp?.eventsAttending ?? []).toEqual([]);
  });

  test('POST /api/rsvp - unchecking every guest clears the attended events', async ({
    request,
  }) => {
    // The converse normalization: no attendees means no attended events, even
    // if the payload still names event ids.
    const response = await request.post(`/api/rsvp`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sargaux_auth=${authCookie}`,
      },
      data: {
        event: 'nyc',
        guestsAttending: [{ name: TEST_GUEST_NAME, attending: false }],
        eventsAttending: nycEventIds,
      },
    });
    expect(response.status()).toBe(200);

    const getRes = await request.get(`/api/rsvp?event=nyc`, {
      headers: { Cookie: `sargaux_auth=${authCookie}` },
    });
    expect(getRes.status()).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.rsvp?.status).toBe('Declined');
    expect(getBody.rsvp?.eventsAttending ?? []).toEqual([]);
  });

  test('POST /api/rsvp - accepts guestId-threaded entries (name write-back path)', async ({
    request,
  }) => {
    // Clean slate.
    for (let i = 0; i < 10; i++) {
      const r = await request.delete(`/api/rsvp?event=nyc`, {
        headers: { Cookie: `sargaux_auth=${authCookie}` },
      });
      if (r.status() !== 200) break;
    }

    // Pull each party member's current id + name straight from the form so we
    // submit matching names — exercising the guestId branch (validation +
    // per-member attendance) WITHOUT triggering a name edit on the shared test
    // party.
    const page = await request.get('/nyc/rsvp', {
      headers: { Cookie: `sargaux_auth=${authCookie}` },
    });
    const html = await page.text();
    const pairs = [
      ...html.matchAll(/data-guest-id="([^"]+)"[\s\S]*?class="guest-name"\s+value="([^"]*)"/g),
    ].map((m) => ({ guestId: m[1], name: m[2], attending: true }));
    expect(pairs.length).toBeGreaterThan(0);

    const response = await request.post(`/api/rsvp`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sargaux_auth=${authCookie}`,
      },
      data: {
        event: 'nyc',
        guestsAttending: pairs,
        eventsAttending: nycEventIds,
        dietary: 'Test dietary',
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    // Round-trips through GET pre-fill with everyone marked attending.
    const getRes = await request.get(`/api/rsvp?event=nyc`, {
      headers: { Cookie: `sargaux_auth=${authCookie}` },
    });
    expect(getRes.status()).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.rsvp?.status).toBe('Attending');
    for (const p of pairs) {
      expect(getBody.rsvp.guestsAttending).toContain(p.name);
    }
  });

  test('POST /api/rsvp - rejects a guestId outside the party', async ({ request }) => {
    const response = await request.post(`/api/rsvp`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sargaux_auth=${authCookie}`,
      },
      data: {
        event: 'nyc',
        guestsAttending: [
          { guestId: '00000000-0000-0000-0000-000000000000', name: 'Mallory', attending: true },
        ],
        eventsAttending: [],
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('outside this party');
  });

  test('GET /api/rsvp - requires authentication', async ({ request }) => {
    const response = await request.get(`/api/rsvp?event=nyc`);

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('GET /api/rsvp - validates event parameter', async ({ request }) => {
    const response = await request.get(`/api/rsvp?event=invalid`, {
      headers: { Cookie: `sargaux_auth=${authCookie}` },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid event');
  });

  test('GET /api/rsvp - returns null for no RSVP', async ({ request }) => {
    // Delete ALL existing France RSVPs to ensure a clean state
    for (let i = 0; i < 10; i++) {
      const r = await request.delete(`/api/rsvp?event=france`, {
        headers: { Cookie: `sargaux_auth=${authCookie}` },
      });
      if (r.status() !== 200) break;
    }

    const response = await request.get(`/api/rsvp?event=france`, {
      headers: { Cookie: `sargaux_auth=${authCookie}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.rsvp).toBeNull();
  });

  test('GET /api/rsvp - returns existing RSVP', async ({ request }) => {
    // Submit RSVP
    await request.post(`/api/rsvp`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sargaux_auth=${authCookie}`,
      },
      data: {
        event: 'nyc',
        guestsAttending: [{ name: TEST_GUEST_NAME, attending: true }],
        eventsAttending: nycEventIds,
        dietary: 'Gluten-free',
        message: 'Can\'t wait!',
        details: {},
      },
    });

    // Fetch RSVP
    const response = await request.get(`/api/rsvp?event=nyc`, {
      headers: { Cookie: `sargaux_auth=${authCookie}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.rsvp).toBeTruthy();
    expect(body.rsvp.event).toBe('nyc');
    expect(body.rsvp.status).toBe('Attending');
    expect(body.rsvp.dietary).toBe('Gluten-free');
    expect(body.rsvp.message).toBe('Can\'t wait!');
    expect(body.rsvp.eventsAttending ?? []).toEqual(nycEventIds);
  });

  test('DELETE /api/rsvp - requires authentication', async ({ request }) => {
    const response = await request.delete(`/api/rsvp?event=nyc`);

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('DELETE /api/rsvp - validates event parameter', async ({ request }) => {
    const response = await request.delete(`/api/rsvp?event=invalid`, {
      headers: { Cookie: `sargaux_auth=${authCookie}` },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid event');
  });

  test('DELETE /api/rsvp - returns 404 if no RSVP exists', async ({ request }) => {
    // Delete once to ensure it's gone
    await request.delete(`/api/rsvp?event=france`, {
      headers: { Cookie: `sargaux_auth=${authCookie}` },
    });

    // Try to delete again
    const response = await request.delete(`/api/rsvp?event=france`, {
      headers: { Cookie: `sargaux_auth=${authCookie}` },
    });

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('No RSVP found');
  });

  test('DELETE /api/rsvp - deletes existing RSVP', async ({ request }) => {
    // Submit RSVP
    await request.post(`/api/rsvp`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sargaux_auth=${authCookie}`,
      },
      data: {
        event: 'nyc',
        guestsAttending: [{ name: TEST_GUEST_NAME, attending: true }],
        eventsAttending: [],
      },
    });

    // Delete RSVP
    const deleteResponse = await request.delete(`/api/rsvp?event=nyc`, {
      headers: { Cookie: `sargaux_auth=${authCookie}` },
    });

    expect(deleteResponse.status()).toBe(200);
    const deleteBody = await deleteResponse.json();
    expect(deleteBody.success).toBe(true);

    // Verify it's gone
    const getResponse = await request.get(`/api/rsvp?event=nyc`, {
      headers: { Cookie: `sargaux_auth=${authCookie}` },
    });

    const getBody = await getResponse.json();
    expect(getBody.rsvp).toBeNull();
  });
});
