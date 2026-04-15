/**
 * Admin endpoint tests
 *
 * Tests auth enforcement and input validation for:
 *   POST /api/admin/send-stds
 *   POST /api/admin/send-email
 *
 * Actual email delivery is skipped because FEATURE_GLOBAL_EMAIL_ENABLED
 * is not set in the test environment (defaults to false), so the endpoints
 * return { skipped: true } instead of calling Resend.
 */

import { test, expect } from '@playwright/test';

// Admin endpoints require Notion backend to fetch guests
const notionRequired =
  process.env.FEATURE_GLOBAL_NOTION_BACKEND !== 'true' ||
  !process.env.NOTION_API_KEY ||
  !process.env.NOTION_GUEST_LIST_DB;

const ADMIN_SECRET = process.env.RESEND_ADMIN_SECRET ?? 'test-secret-not-set';

test.describe('Admin: send-stds', () => {
  test.skip(notionRequired, 'Notion backend required for admin endpoint tests');

  test('returns 401 without Authorization header', async ({ request }) => {
    const res = await request.post('/api/admin/send-stds', {
      data: { event: 'nyc' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('returns 401 with wrong secret', async ({ request }) => {
    const res = await request.post('/api/admin/send-stds', {
      headers: { Authorization: 'Bearer wrong-secret' },
      data: { event: 'nyc' },
    });
    expect(res.status()).toBe(401);
  });

  test('returns 400 with invalid event', async ({ request }) => {
    const res = await request.post('/api/admin/send-stds', {
      headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
      data: { event: 'invalid' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid event/i);
  });

  test('returns 200 with nyc event (email send skipped — flag off)', async ({ request }) => {
    const res = await request.post('/api/admin/send-stds', {
      headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
      data: { event: 'nyc' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // emailEnabled is off in test env → skipped summary
    expect(typeof body.noEmail).toBe('number');
  });

  test('returns 200 with france event (email send skipped — flag off)', async ({ request }) => {
    const res = await request.post('/api/admin/send-stds', {
      headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
      data: { event: 'france' },
    });
    expect(res.status()).toBe(200);
  });
});

test.describe('Admin: send-email', () => {
  test.skip(notionRequired, 'Notion backend required for admin endpoint tests');

  test('returns 401 without Authorization header', async ({ request }) => {
    const res = await request.post('/api/admin/send-email', {
      data: { templateId: 'save-the-date-nyc', guestIds: ['some-id'] },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('returns 401 with wrong secret', async ({ request }) => {
    const res = await request.post('/api/admin/send-email', {
      headers: { Authorization: 'Bearer wrong-secret' },
      data: { templateId: 'save-the-date-nyc', guestIds: ['some-id'] },
    });
    expect(res.status()).toBe(401);
  });

  test('returns 400 with invalid templateId', async ({ request }) => {
    const res = await request.post('/api/admin/send-email', {
      headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
      data: { templateId: 'does-not-exist', guestIds: ['some-id'] },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid templateid/i);
  });

  test('returns 400 with missing guestIds', async ({ request }) => {
    const res = await request.post('/api/admin/send-email', {
      headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
      data: { templateId: 'save-the-date-nyc' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/guestids/i);
  });

  test('returns 400 with empty guestIds array', async ({ request }) => {
    const res = await request.post('/api/admin/send-email', {
      headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
      data: { templateId: 'save-the-date-nyc', guestIds: [] },
    });
    expect(res.status()).toBe(400);
  });

  test('returns 200 with valid templateId and guestIds (email send skipped — flag off)', async ({ request }) => {
    const res = await request.post('/api/admin/send-email', {
      headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
      data: { templateId: 'save-the-date-nyc', guestIds: ['00000000-0000-0000-0000-000000000000'] },
    });
    // 200 even if guestId isn't found (noEmail: 1, sent: 0)
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.noEmail).toBe('number');
  });
});
