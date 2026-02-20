/**
 * RSVP API endpoint tests
 *
 * Tests for /api/rsvp POST, GET, and DELETE endpoints
 *
 * NOTE: These tests require:
 * - Notion backend enabled (FEATURE_GLOBAL_NOTION_BACKEND=true)
 * - Valid NOTION_API_KEY, NOTION_GUEST_LIST_DB, NOTION_RSVP_RESPONSES_DB env vars
 * - Test guest (Sam Gross) exists in Notion Guest List database
 *
 * Skip these tests if Notion backend is not configured.
 */

import { test, expect } from '@playwright/test';

const TEST_GUEST_NAME = 'Sam Gross'; // Must exist in Notion Guest List
const BASE_URL = 'http://localhost:1213'; // December 13th - engagement date!

test.describe('RSVP API Endpoints', () => {
  // Run tests serially — they write to shared Notion state (Sam Gross's RSVPs)
  // and must not run in parallel with each other.
  test.describe.configure({ mode: 'serial' });

  let authCookie: string | undefined;

  // Skip all tests if Notion backend is not enabled
  // This is detected by checking if the login redirects to /nyc (Notion enabled) or stays on / (hardcoded list)
  test.skip(
    !process.env.FEATURE_GLOBAL_NOTION_BACKEND ||
      process.env.FEATURE_GLOBAL_NOTION_BACKEND !== 'true',
    'Notion backend not configured'
  );

  test.beforeAll(async ({ browser }) => {
    // Login once to get auth cookie
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/`);
    await page.click('#login-trigger');
    await page.fill('#name', TEST_GUEST_NAME);
    await page.click('#submit-btn');
    await page.waitForURL(`${BASE_URL}/nyc`);

    const cookies = await context.cookies();
    const auth = cookies.find(c => c.name === 'sargaux_auth');
    authCookie = auth?.value;

    // Clean up any existing RSVPs for the test guest to ensure a clean slate.
    // Loop until all RSVPs are deleted (there may be multiple from prior test runs).
    if (authCookie) {
      for (const event of ['nyc', 'france'] as const) {
        for (let i = 0; i < 10; i++) {
          const r = await page.request.delete(`${BASE_URL}/api/rsvp?event=${event}`, {
            headers: { Cookie: `sargaux_auth=${authCookie}`, Origin: BASE_URL },
          });
          if (r.status() !== 200) break; // 404 = none left, stop
        }
      }
    }

    await context.close();

    expect(authCookie).toBeTruthy();
  });

  test('POST /api/rsvp - requires authentication', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/rsvp`, {
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
    const response = await request.post(`${BASE_URL}/api/rsvp`, {
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
    const response = await request.post(`${BASE_URL}/api/rsvp`, {
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

  test('POST /api/rsvp - submits new RSVP successfully', async ({ request }) => {
    // First, delete ALL existing NYC RSVPs to ensure a clean state
    for (let i = 0; i < 10; i++) {
      const r = await request.delete(`${BASE_URL}/api/rsvp?event=nyc`, {
        headers: { Cookie: `sargaux_auth=${authCookie}`, Origin: BASE_URL },
      });
      if (r.status() !== 200) break;
    }

    // Submit new RSVP
    const response = await request.post(`${BASE_URL}/api/rsvp`, {
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
        details: {
          songRequest: 'Dancing Queen - ABBA',
        },
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.responseId).toBeTruthy();
  });

  test('POST /api/rsvp - updates existing RSVP', async ({ request }) => {
    // Submit initial RSVP
    const response1 = await request.post(`${BASE_URL}/api/rsvp`, {
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
    const response2 = await request.post(`${BASE_URL}/api/rsvp`, {
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

  test('GET /api/rsvp - requires authentication', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/rsvp?event=nyc`);

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('GET /api/rsvp - validates event parameter', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/rsvp?event=invalid`, {
      headers: { Cookie: `sargaux_auth=${authCookie}` },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid event');
  });

  test('GET /api/rsvp - returns null for no RSVP', async ({ request }) => {
    // Delete ALL existing France RSVPs to ensure a clean state
    for (let i = 0; i < 10; i++) {
      const r = await request.delete(`${BASE_URL}/api/rsvp?event=france`, {
        headers: { Cookie: `sargaux_auth=${authCookie}`, Origin: BASE_URL },
      });
      if (r.status() !== 200) break;
    }

    const response = await request.get(`${BASE_URL}/api/rsvp?event=france`, {
      headers: { Cookie: `sargaux_auth=${authCookie}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.rsvp).toBeNull();
  });

  test('GET /api/rsvp - returns existing RSVP', async ({ request }) => {
    // Submit RSVP
    await request.post(`${BASE_URL}/api/rsvp`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sargaux_auth=${authCookie}`,
      },
      data: {
        event: 'nyc',
        guestsAttending: [{ name: TEST_GUEST_NAME, attending: true }],
        eventsAttending: [],
        dietary: 'Gluten-free',
        message: 'Can\'t wait!',
        details: {
          songRequest: 'September - Earth Wind & Fire',
        },
      },
    });

    // Fetch RSVP
    const response = await request.get(`${BASE_URL}/api/rsvp?event=nyc`, {
      headers: { Cookie: `sargaux_auth=${authCookie}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.rsvp).toBeTruthy();
    expect(body.rsvp.event).toBe('nyc');
    expect(body.rsvp.status).toBe('Attending');
    expect(body.rsvp.dietary).toBe('Gluten-free');
    expect(body.rsvp.message).toBe('Can\'t wait!');
    expect(body.rsvp.details?.songRequest).toBe('September - Earth Wind & Fire');
  });

  test('DELETE /api/rsvp - requires authentication', async ({ request }) => {
    const response = await request.delete(`${BASE_URL}/api/rsvp?event=nyc`, {
      headers: { Origin: BASE_URL },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('DELETE /api/rsvp - validates event parameter', async ({ request }) => {
    const response = await request.delete(`${BASE_URL}/api/rsvp?event=invalid`, {
      headers: { Cookie: `sargaux_auth=${authCookie}`, Origin: BASE_URL },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid event');
  });

  test('DELETE /api/rsvp - returns 404 if no RSVP exists', async ({ request }) => {
    // Delete once to ensure it's gone
    await request.delete(`${BASE_URL}/api/rsvp?event=france`, {
      headers: { Cookie: `sargaux_auth=${authCookie}`, Origin: BASE_URL },
    });

    // Try to delete again
    const response = await request.delete(`${BASE_URL}/api/rsvp?event=france`, {
      headers: { Cookie: `sargaux_auth=${authCookie}`, Origin: BASE_URL },
    });

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('No RSVP found');
  });

  test('DELETE /api/rsvp - deletes existing RSVP', async ({ request }) => {
    // Submit RSVP
    await request.post(`${BASE_URL}/api/rsvp`, {
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
    const deleteResponse = await request.delete(`${BASE_URL}/api/rsvp?event=nyc`, {
      headers: { Cookie: `sargaux_auth=${authCookie}`, Origin: BASE_URL },
    });

    expect(deleteResponse.status()).toBe(200);
    const deleteBody = await deleteResponse.json();
    expect(deleteBody.success).toBe(true);

    // Verify it's gone
    const getResponse = await request.get(`${BASE_URL}/api/rsvp?event=nyc`, {
      headers: { Cookie: `sargaux_auth=${authCookie}` },
    });

    const getBody = await getResponse.json();
    expect(getBody.rsvp).toBeNull();
  });
});
