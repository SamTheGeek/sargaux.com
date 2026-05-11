/**
 * Calendar endpoint tests.
 *
 * These tests use the mock blob store (CALENDAR_TEST_MODE=true) and a fixed
 * CALENDAR_HMAC_SECRET so they run without Netlify infrastructure or Notion.
 *
 * Skip guard: if CALENDAR_TEST_MODE is not set, all tests skip gracefully.
 */

import { test, expect } from '@playwright/test';
import { generateToken, buildICS } from '../src/lib/calendar';
import type { EventWithDate } from '../src/lib/calendar';

const BASE_URL = 'http://localhost:1213';
const TEST_SECRET = 'test-hmac-secret-for-unit-tests';
const TEST_GUEST_ID = 'abc123-test-notion-page-id';
const UNKNOWN_GUEST_ID = 'ffffffff-0000-no-blob-here';

process.env.CALENDAR_HMAC_SECRET = TEST_SECRET;

const TEST_EVENT: EventWithDate = {
  id: 'event-test-1',
  name: 'Wedding Dinner',
  type: 'Core',
  wedding: 'nyc',
  date: '2026-10-11',
  startTime: '6:00 PM',
  duration: '3h',
  location: 'The Venue',
  showOnWebsite: true,
};

const isMockMode = process.env.CALENDAR_TEST_MODE === 'true';

test.describe('Calendar endpoint (mock blob store)', () => {
  test.skip(!isMockMode, 'Requires CALENDAR_TEST_MODE=true on the server');

  let validToken: string;
  let unknownToken: string;

  test.beforeAll(async ({ request }) => {
    validToken = generateToken(TEST_GUEST_ID);
    unknownToken = generateToken(UNKNOWN_GUEST_ID);
    const testICS = buildICS([TEST_EVENT]);

    // Seed the mock blob store via the test-seed endpoint
    const res = await request.post(`${BASE_URL}/api/calendar/test-seed`, {
      data: { token: validToken, ics: testICS },
    });
    expect(res.status()).toBe(200);
  });

  test('valid token with seeded blob returns 200 text/calendar', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/calendar/${validToken}.ics`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/calendar');
  });

  test('ICS body contains expected calendar envelope', async ({ request }) => {
    const body = await request.get(`${BASE_URL}/api/calendar/${validToken}.ics`).then(r => r.text());
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('END:VCALENDAR');
    expect(body).toContain('X-WR-CALNAME:Sargaux Wedding');
  });

  test('ICS body contains the seeded VEVENT', async ({ request }) => {
    const body = await request.get(`${BASE_URL}/api/calendar/${validToken}.ics`).then(r => r.text());
    expect(body).toContain('BEGIN:VEVENT');
    expect(body).toContain('SUMMARY:Wedding Dinner');
    expect(body).toContain('DTSTART;TZID=America/New_York:20261011T180000');
  });

  test('valid token with no blob returns 503', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/calendar/${unknownToken}.ics`);
    expect(res.status()).toBe(503);
  });

  test('invalid token returns 404', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/calendar/not-a-real-token.ics`);
    expect(res.status()).toBe(404);
  });

  test('tampered HMAC returns 404', async ({ request }) => {
    const dot = validToken.indexOf('.');
    const tampered = validToken.slice(0, dot + 1) + 'a'.repeat(32);
    const res = await request.get(`${BASE_URL}/api/calendar/${tampered}.ics`);
    expect(res.status()).toBe(404);
  });

  test('test-seed endpoint returns 404 in non-test mode', async () => {
    // This test only makes sense running against a non-test server.
    test.skip(true, 'Requires a separate non-test server instance to verify');
  });
});
