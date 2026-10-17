import { test, expect, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createSessionToken, type EventInvitation } from '../src/lib/auth';

/*
  The 404 page's one control is a Home button that links to `/`, not to an
  event route. The homepage owns the "where is home" decision: it sends a
  logged-in guest to their default event route and shows everyone else the
  login. These tests follow the button in both states. Single-event cookies keep
  them independent of the dual-invite date cutoff.

  `/nycfoo` is the route-patterns case: it used to count as an NYC route and
  bounce to login, and now it's a plain unmatched path.
*/

async function setSessionCookie(context: BrowserContext, eventInvitations: EventInvitation[]) {
  await context.addCookies([
    {
      name: 'sargaux_auth',
      value: createSessionToken('Not Found Test Guest', undefined, eventInvitations),
      url: 'http://127.0.0.1:1213',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

test.describe('404 page', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  for (const path of ['/nycfoo', '/no-such-page', '/nyc%2Ftravel']) {
    test(`${path} returns 404 with a Home button to /`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
      await expect(page.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    });
  }

  test('logged out, Home leads to the login', async ({ page }) => {
    await page.goto('/nycfoo');
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('.landing-shell')).toBeVisible();
  });

  test('logged in, Home leads to the guest\'s event route', async ({ page, context }) => {
    await setSessionCookie(context, ['france']);
    await page.goto('/nycfoo');
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL('/france');
  });

  test('a real protected route still redirects to login, not 404', async ({ page }) => {
    const response = await page.request.get('/nyc/travel', { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toBe('/?next=%2Fnyc%2Ftravel');
  });

  test('is in French for a French-language visitor', async ({ page, context }) => {
    await context.addCookies([{ name: 'sargaux_lang', value: 'fr', url: 'http://127.0.0.1:1213' }]);
    await page.goto('/nycfoo');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page introuvable');
    await expect(page.getByRole('link', { name: 'Accueil' })).toHaveAttribute('href', '/');
  });

  // Dark mode too: .btn-primary's label and background are both cream there,
  // which is what the page's --color-bg override fixes. Axe's contrast rule
  // catches it if that ever regresses.
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`has no accessibility violations (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/nycfoo');
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
