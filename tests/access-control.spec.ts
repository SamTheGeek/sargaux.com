import { test, expect, type BrowserContext } from '@playwright/test';
import { createSessionToken, type EventInvitation } from '../src/lib/auth';

async function setSessionCookie(
  context: BrowserContext,
  eventInvitations: EventInvitation[]
) {
  const value = createSessionToken('Access Test Guest', undefined, eventInvitations);
  await context.addCookies([
    {
      name: 'sargaux_auth',
      value,
      url: 'http://127.0.0.1:1213',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

test.describe('Event Access Control', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('NYC-only guest is redirected from France URLs to /nyc', async ({ page, context }) => {
    await setSessionCookie(context, ['nyc']);

    await page.goto('/france/details');
    await expect(page).toHaveURL('/nyc');
  });

  test('France-only guest is redirected from NYC URLs to /france', async ({ page, context }) => {
    await setSessionCookie(context, ['france']);

    await page.goto('/nyc/travel');
    await expect(page).toHaveURL('/france');
  });

  test('single-event guest does not see event switcher', async ({ page, context }) => {
    await setSessionCookie(context, ['nyc']);

    await page.goto('/nyc');
    await expect(page.locator('.event-toggle')).toHaveCount(0);
  });

  test('homepage redirects to the guest primary event', async ({ page, context }) => {
    await setSessionCookie(context, ['france']);
    await page.goto('/');
    await expect(page).toHaveURL('/france');
  });

  test('homepage redirects dual-invited guests to NYC before October 15, 2026', async ({ page, context }) => {
    await setSessionCookie(context, ['nyc', 'france']);
    await page.goto('/');
    await expect(page).toHaveURL('/nyc');
  });

  test('dual-invited guest can access both events and sees switcher', async ({ page, context }) => {
    await setSessionCookie(context, ['nyc', 'france']);

    await page.goto('/nyc');
    await expect(page.locator('.event-toggle')).toBeVisible();

    await page.goto('/france');
    await expect(page.locator('.event-toggle')).toBeVisible();
  });
});
