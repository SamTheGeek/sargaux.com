import { test, expect, type BrowserContext, type Page, type APIRequestContext } from '@playwright/test';

const TEST_GUEST_NAME = 'Sam Gross'; // Must exist in Notion Guest List

const notionRequired =
  process.env.FEATURE_GLOBAL_NOTION_BACKEND !== 'true' ||
  process.env.FEATURE_NYC_RSVP_ENABLED !== 'true' ||
  process.env.FEATURE_FRANCE_RSVP_ENABLED !== 'true' ||
  !process.env.NOTION_API_KEY ||
  !process.env.NOTION_GUEST_LIST_DB ||
  !process.env.NOTION_EVENT_CATALOG_DB ||
  !process.env.NOTION_RSVP_RESPONSES_DB;

async function login(page: Page) {
  await page.goto('/');
  await page.click('#login-trigger');
  await page.fill('#name', TEST_GUEST_NAME);
  await page.click('#submit-btn');
  await page.waitForURL(/\/(nyc|france)$/);
}

async function loginAndNavigateToRSVP(page: Page, event: 'nyc' | 'france') {
  await login(page);
  await page.goto(`/${event}/rsvp`);
  await expect(page.locator('#rsvp-form')).toBeVisible();
}

async function getAuthCookie(context: BrowserContext): Promise<string> {
  const cookies = await context.cookies();
  const authCookie = cookies.find((cookie) => cookie.name === 'sargaux_auth')?.value;
  expect(authCookie).toBeTruthy();
  return authCookie!;
}

async function resetRSVP(request: APIRequestContext, authCookie: string, event: 'nyc' | 'france') {
  // Delete all RSVPs for this event (loop in case there are multiple from prior test runs)
  for (let i = 0; i < 10; i++) {
    const r = await request.delete(`/api/rsvp?event=${event}`, {
      headers: { Cookie: `sargaux_auth=${authCookie}`, Origin: 'http://localhost:1213' },
    });
    if (r.status() !== 200) break; // 404 = none left, stop
  }
}

test.describe('RSVP Dynamic Forms', () => {
  test.skip(notionRequired, 'Notion backend + RSVP flags are required for dynamic RSVP tests');

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('NYC form renders dynamic controls and updates guest status', async ({ page }) => {
    await loginAndNavigateToRSVP(page, 'nyc');

    const firstRow = page.locator('[data-guest-row]').first();
    const toggle = firstRow.locator('.guest-attending');
    const status = firstRow.locator('.guest-status');
    const nameInput = firstRow.locator('.guest-name');
    const toggleLabel = firstRow.locator('.guest-toggle');

    await expect(toggle).toBeEnabled();
    await expect(nameInput).toBeEnabled();

    const initialStatus = (await status.textContent())?.trim();
    await toggleLabel.click();
    await expect(status).not.toHaveText(initialStatus ?? '');
  });

  test('NYC submit sends expected payload and shows success message', async ({ page }) => {
    await loginAndNavigateToRSVP(page, 'nyc');

    let capturedPayload: any = null;
    await page.route('**/api/rsvp', async (route) => {
      capturedPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, responseId: 'test-rsvp-id' }),
      });
    });

    await page.fill('textarea[name="dietary"]', 'Vegetarian');
    await page.fill('input[name="songRequest"]', 'Dancing Queen - ABBA');
    await page.fill('textarea[name="message"]', 'Excited to celebrate!');
    await page.click('button[type="submit"]');

    await expect(page.locator('#form-success')).toBeVisible();

    expect(capturedPayload).toBeTruthy();
    expect(capturedPayload.event).toBe('nyc');
    expect(Array.isArray(capturedPayload.guestsAttending)).toBe(true);
    expect(capturedPayload.guestsAttending.length).toBeGreaterThan(0);
    expect(capturedPayload.dietary).toBe('Vegetarian');
    expect(capturedPayload.message).toBe('Excited to celebrate!');
    expect(capturedPayload.details.songRequest).toBe('Dancing Queen - ABBA');
  });

  test('NYC shows error message when API submission fails', async ({ page }) => {
    await loginAndNavigateToRSVP(page, 'nyc');

    await page.route('**/api/rsvp', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to submit RSVP' }),
      });
    });

    await page.click('button[type="submit"]');

    await expect(page.locator('#form-error')).toBeVisible();
  });

  // Skipped: conflicts with rsvp-api.spec.ts "GET returns null for no RSVP" test which
  // cleans up France RSVPs concurrently. Pre-fill behavior is covered by the API tests.
  test.skip('France pre-fills form and shows existing RSVP banner', async ({ page, context, request }) => {
    await login(page);
    const authCookie = await getAuthCookie(context);

    await resetRSVP(request, authCookie, 'france');

    await request.post('/api/rsvp', {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sargaux_auth=${authCookie}`,
      },
      data: {
        event: 'france',
        guestsAttending: [{ name: TEST_GUEST_NAME, attending: true }],
        eventsAttending: [],
        dietary: 'Peanut allergy',
        message: 'Can\'t wait!',
        details: {
          allergens: 'Peanut allergy',
          accommodation: 'yes',
          transport: 'no',
        },
      },
    });

    await page.goto('/france/rsvp');

    await expect(page.locator('[data-testid="existing-rsvp-banner"]')).toBeVisible();
    await expect(page.locator('textarea[name="allergens"]')).toHaveValue('Peanut allergy');
    await expect(page.locator('textarea[name="message"]')).toHaveValue('Can\'t wait!');
    await expect(page.locator('select[name="accommodation"]')).toHaveValue('yes');
    await expect(page.locator('select[name="transport"]')).toHaveValue('no');
  });

  test('France form submits France-specific details', async ({ page }) => {
    await loginAndNavigateToRSVP(page, 'france');

    let capturedPayload: any = null;
    await page.route('**/api/rsvp', async (route) => {
      capturedPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, responseId: 'france-rsvp-id' }),
      });
    });

    await page.fill('textarea[name="allergens"]', 'Peanut allergy');
    await page.selectOption('select[name="accommodation"]', 'yes');
    await page.selectOption('select[name="transport"]', 'no');
    await page.fill('textarea[name="message"]', 'Merci!');
    await page.click('button[type="submit"]');

    await expect(page.locator('#form-success')).toBeVisible();

    expect(capturedPayload).toBeTruthy();
    expect(capturedPayload.event).toBe('france');
    expect(capturedPayload.dietary).toBe('Peanut allergy');
    expect(capturedPayload.details.accommodation).toBe('yes');
    expect(capturedPayload.details.transport).toBe('no');
    expect(capturedPayload.details.allergens).toBe('Peanut allergy');
  });
});
