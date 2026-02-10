/**
 * RSVP UI Tests
 *
 * Tests for RSVP form behavior and submission flow
 *
 * NOTE: These tests are placeholders until Phase 3 (Dynamic RSVP Forms) is implemented.
 * Currently the RSVP pages are static wireframes with disabled inputs.
 * Most tests are marked as .skip() and will be enabled in Phase 3.
 */

import { test, expect } from '@playwright/test';

const TEST_GUEST_NAME = 'Sam Gross'; // Must exist in Notion Guest List
const BASE_URL = 'http://localhost:1213'; // December 13th - engagement date!

/**
 * Helper: Login and navigate to RSVP page
 */
async function loginAndNavigateToRSVP(page: any, event: 'nyc' | 'france') {
  await page.goto('${BASE_URL}/');
  await page.click('#login-trigger');
  await page.fill('#name', TEST_GUEST_NAME);
  await page.click('#submit-btn');
  await page.waitForURL(/\/(nyc|france)/);
  await page.goto(`${BASE_URL}/${event}/rsvp`);
}

test.describe('RSVP Pages - Basic Structure', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('NYC RSVP page - requires authentication', async ({ page }) => {
    await page.goto('${BASE_URL}/nyc/rsvp');
    await page.waitForURL('${BASE_URL}/');
    expect(page.url()).toBe('${BASE_URL}/');
  });

  test('France RSVP page - requires authentication', async ({ page }) => {
    await page.goto('${BASE_URL}/france/rsvp');
    await page.waitForURL('${BASE_URL}/');
    expect(page.url()).toBe('${BASE_URL}/');
  });

  test('NYC RSVP page - loads when authenticated', async ({ page }) => {
    await loginAndNavigateToRSVP(page, 'nyc');
    await expect(page.locator('h1')).toContainText('RSVP');
    await expect(page.locator('.subtitle')).toContainText('New York');
  });

  test('France RSVP page - loads when authenticated', async ({ page }) => {
    await loginAndNavigateToRSVP(page, 'france');
    await expect(page.locator('h1')).toContainText('RSVP');
    await expect(page.locator('.subtitle')).toContainText('France');
  });

  test('RSVP form - has all required sections', async ({ page }) => {
    await loginAndNavigateToRSVP(page, 'nyc');

    // Check for form sections
    await expect(page.locator('h2:has-text("Who\'s Coming?")')).toBeVisible();
    await expect(page.locator('h2:has-text("Optional Events")')).toBeVisible();
    await expect(page.locator('h2:has-text("Dietary Restrictions")')).toBeVisible();
    await expect(page.locator('h2:has-text("Message for Us")')).toBeVisible();

    // NYC-specific: Song Request
    await expect(page.locator('h2:has-text("Song Request")')).toBeVisible();
  });
});

test.describe('RSVP Form - Phase 3 Implementation Tests', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  // TODO: Enable these tests once Phase 3 (Dynamic RSVP Forms) is implemented
  // Current state: Form inputs are disabled wireframe elements

  test.skip('Form submission - shows loading state', async ({ page }) => {
    await loginAndNavigateToRSVP(page, 'nyc');

    // Fill out form
    await page.check('input[name="guest_1_attending"]');
    await page.fill('textarea[name="dietary"]', 'Vegetarian');
    await page.click('button[type="submit"]');

    // Should show loading state
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test.skip('Form submission - displays success message', async ({ page }) => {
    await loginAndNavigateToRSVP(page, 'nyc');

    // Fill and submit form
    await page.check('input[name="guest_1_attending"]');
    await page.click('button[type="submit"]');

    // Should show success message
    await expect(page.locator('.success-message')).toBeVisible();
    await expect(page.locator('.success-message')).toContainText('RSVP submitted');
  });

  test.skip('Form submission - handles API errors gracefully', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/rsvp', route => route.abort());

    await loginAndNavigateToRSVP(page, 'nyc');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('.error-message')).toBeVisible();
  });

  test.skip('Existing RSVP - shows "already submitted" banner', async ({ page, request }) => {
    // Submit RSVP first
    await loginAndNavigateToRSVP(page, 'nyc');
    const cookies = await page.context().cookies();
    const authCookie = cookies.find(c => c.name === 'sargaux_auth')?.value;

    await request.post('${BASE_URL}/api/rsvp', {
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

    // Reload page
    await page.reload();

    // Should show "already submitted" banner
    await expect(page.locator('.existing-rsvp-banner')).toBeVisible();
    await expect(page.locator('.existing-rsvp-banner')).toContainText('already RSVP');
  });

  test.skip('Form pre-fill - loads existing RSVP data', async ({ page, request }) => {
    // Submit RSVP with specific data
    await loginAndNavigateToRSVP(page, 'nyc');
    const cookies = await page.context().cookies();
    const authCookie = cookies.find(c => c.name === 'sargaux_auth')?.value;

    await request.post('${BASE_URL}/api/rsvp', {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sargaux_auth=${authCookie}`,
      },
      data: {
        event: 'nyc',
        guestsAttending: [{ name: TEST_GUEST_NAME, attending: true }],
        eventsAttending: [],
        dietary: 'Gluten-free',
        message: 'Excited!',
        details: {
          songRequest: 'Happy - Pharrell Williams',
        },
      },
    });

    // Reload page
    await page.reload();

    // Form should be pre-filled
    await expect(page.locator('textarea[name="dietary"]')).toHaveValue('Gluten-free');
    await expect(page.locator('textarea[name="message"]')).toHaveValue('Excited!');
    await expect(page.locator('input[name="song"]')).toHaveValue('Happy - Pharrell Williams');
  });

  test.skip('Guest toggles - reflect attendance status', async ({ page }) => {
    await loginAndNavigateToRSVP(page, 'nyc');

    const toggle = page.locator('input[name="guest_1_attending"]');
    const status = page.locator('.guest-status').first();

    // Initially checked
    await expect(toggle).toBeChecked();
    await expect(status).toContainText('Attending');

    // Uncheck
    await toggle.uncheck();
    await expect(status).toContainText('Not attending');
  });

  test.skip('Email capture - shows field when email missing', async ({ page }) => {
    // TODO: Mock guest record without email
    await loginAndNavigateToRSVP(page, 'nyc');

    // Should show email input
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('label:has-text("Email")')).toBeVisible();
  });

  test.skip('Email capture - validates email format', async ({ page }) => {
    await loginAndNavigateToRSVP(page, 'nyc');

    // Enter invalid email
    await page.fill('input[name="email"]', 'invalid-email');
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.locator('.email-error')).toBeVisible();
  });
});

test.describe('RSVP Form - Event-Specific Fields', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test.skip('NYC RSVP - includes song request field', async ({ page }) => {
    await loginAndNavigateToRSVP(page, 'nyc');
    await expect(page.locator('input[name="song"]')).toBeVisible();
  });

  test.skip('France RSVP - includes accommodation field', async ({ page }) => {
    await loginAndNavigateToRSVP(page, 'france');
    await expect(page.locator('select[name="accommodation"]')).toBeVisible();
  });

  test.skip('France RSVP - includes allergen field', async ({ page }) => {
    await loginAndNavigateToRSVP(page, 'france');
    await expect(page.locator('textarea[name="allergens"]')).toBeVisible();
  });

  test.skip('France RSVP - includes transport field', async ({ page }) => {
    await loginAndNavigateToRSVP(page, 'france');
    await expect(page.locator('select[name="transport"]')).toBeVisible();
  });
});

test.describe('RSVP Optional Events', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test.skip('Optional events - only shows invited events', async ({ page }) => {
    // TODO: Mock different guest invitation scenarios
    await loginAndNavigateToRSVP(page, 'nyc');

    // Should only show events this guest is invited to
    const optionalEvents = page.locator('.optional-event');
    await expect(optionalEvents).toBeTruthy();
  });

  test.skip('Optional events - can be toggled independently', async ({ page }) => {
    await loginAndNavigateToRSVP(page, 'nyc');

    const event1 = page.locator('input[name="event_friday"]');
    const event2 = page.locator('input[name="event_sunday"]');

    await event1.check();
    await expect(event1).toBeChecked();
    await expect(event2).not.toBeChecked();

    await event2.check();
    await expect(event2).toBeChecked();
  });
});
