/**
 * Calendar subscription endpoint tests
 *
 * Tests for GET /api/calendar/[token].ics
 *
 * NOTE: These tests require:
 * - FEATURE_GLOBAL_NOTION_BACKEND=true
 * - FEATURE_NYC_CALENDAR_SUBSCRIBE=true or FEATURE_FRANCE_CALENDAR_SUBSCRIBE=true
 * - CALENDAR_HMAC_SECRET set
 * - Valid NOTION_API_KEY, NOTION_GUEST_LIST_DB, NOTION_EVENT_CATALOG_DB env vars
 * - Test guest (Sam Gross) exists in Notion Guest List database
 *
 * Skip gracefully if environment is not configured.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:1213'; // December 13th - engagement date!
const TEST_GUEST_NAME = 'Sam Gross'; // Must exist in Notion Guest List

const notionEnabled =
  process.env.FEATURE_GLOBAL_NOTION_BACKEND === 'true' &&
  !!process.env.CALENDAR_HMAC_SECRET;

const calendarEnabled =
  process.env.FEATURE_NYC_CALENDAR_SUBSCRIBE === 'true' ||
  process.env.FEATURE_FRANCE_CALENDAR_SUBSCRIBE === 'true';

test.describe('Calendar ICS Endpoint', () => {
  let calendarToken: string | undefined;

  test.skip(
    !notionEnabled || !calendarEnabled,
    'Notion backend or calendar feature not configured'
  );

  test.beforeAll(async ({ browser }) => {
    // Log in as Sam Gross and extract the calendar token from the page
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/`);
    await page.click('#login-trigger');
    await page.fill('#name', TEST_GUEST_NAME);
    await page.click('#submit-btn');
    await page.waitForURL(`${BASE_URL}/nyc`);

    // Extract the webcal:// href from the Add to Calendar link
    const href = await page.locator('a.calendar-btn-prominent').getAttribute('href');
    if (href) {
      // href = "webcal://sargaux.com/api/calendar/TOKEN.ics"
      const match = href.match(/\/api\/calendar\/(.+)\.ics$/);
      calendarToken = match?.[1];
    }

    await context.close();
  });

  test('valid token returns 200 with text/calendar content type', async ({ request }) => {
    test.skip(!calendarToken, 'Could not extract calendar token from page');
    const response = await request.get(`${BASE_URL}/api/calendar/${calendarToken}.ics`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/calendar');
  });

  test('valid token ICS starts and ends with VCALENDAR', async ({ request }) => {
    test.skip(!calendarToken, 'Could not extract calendar token from page');
    const body = await request.get(`${BASE_URL}/api/calendar/${calendarToken}.ics`).then(r => r.text());
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('END:VCALENDAR');
  });

  test('ICS contains calendar name Sargaux Wedding', async ({ request }) => {
    test.skip(!calendarToken, 'Could not extract calendar token from page');
    const body = await request.get(`${BASE_URL}/api/calendar/${calendarToken}.ics`).then(r => r.text());
    expect(body).toContain('X-WR-CALNAME:Sargaux Wedding');
  });

  test('ICS contains at least one VEVENT', async ({ request }) => {
    test.skip(!calendarToken, 'Could not extract calendar token from page');
    const body = await request.get(`${BASE_URL}/api/calendar/${calendarToken}.ics`).then(r => r.text());
    expect(body).toContain('BEGIN:VEVENT');
    expect(body).toContain('END:VEVENT');
  });

  test('invalid token returns 404', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/calendar/not-a-real-token.ics`);
    expect(response.status()).toBe(404);
  });

  test('tampered HMAC returns 404', async ({ request }) => {
    test.skip(!calendarToken, 'Could not extract calendar token from page');
    // Corrupt the HMAC portion of a valid token
    const dotIndex = calendarToken!.indexOf('.');
    const encoded = calendarToken!.slice(0, dotIndex);
    const tamperedToken = `${encoded}.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`;
    const response = await request.get(`${BASE_URL}/api/calendar/${tamperedToken}.ics`);
    expect(response.status()).toBe(404);
  });
});
