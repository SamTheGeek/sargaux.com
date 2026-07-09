import { test, expect } from '@playwright/test';

/**
 * Guards the language-switcher CDN caching contract.
 *
 * The switcher works by linking to `?lang=fr`, which the middleware turns into
 * a French render + a `sargaux_lang` cookie. Content pages are CDN-cached with a
 * custom `Netlify-Vary` header — and setting a custom `Netlify-Vary` makes the
 * Netlify CDN STOP varying the cache on the query string. Without `query=lang`
 * in that header, `/page?lang=fr` collides with the cached English variant (same
 * cookies, since `sargaux_lang` hasn't flipped yet), is served from cache, never
 * reaches the origin, and the switcher becomes a silent no-op on the live site.
 *
 * CDN caching is Netlify-only and inert under the node adapter these tests run
 * against, so the CDN behavior itself can't be exercised locally. The testable
 * invariant is the header contract (the cache key) plus the origin actually
 * flipping the cookie on `?lang=fr`.
 */
test.describe('i18n language switching', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('content responses vary the CDN cache on the lang query param', async ({ page }) => {
    const response = await page.goto('/');

    const vary = response?.headers()['netlify-vary'];
    expect(vary, 'Netlify-Vary header must be present on content responses').toBeTruthy();
    // `query=lang` is the fix: it keeps `?lang=fr` from colliding with the
    // cached English variant. Removing it reintroduces the no-op switcher bug.
    expect(vary).toContain('query=lang');
    expect(vary).toContain('sargaux_lang');
  });

  test('?lang=fr renders French and sets the sargaux_lang cookie at the origin', async ({ page, context }) => {
    await page.goto('/?lang=fr');

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

    const cookies = await context.cookies();
    const langCookie = cookies.find((c) => c.name === 'sargaux_lang');
    expect(langCookie, 'origin must set sargaux_lang so the choice persists').toBeDefined();
    expect(langCookie!.value).toBe('fr');
  });

  test('?lang=en overrides a stored French preference back to English', async ({ page }) => {
    // Establish a French preference first.
    await page.goto('/?lang=fr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

    // Switching back to English must take effect (guards the reverse direction).
    await page.goto('/?lang=en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
