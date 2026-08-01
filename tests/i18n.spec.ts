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

/**
 * Pre-login language detection.
 *
 * Before a guest logs in there is no Notion `Country` and no `sargaux_lang`
 * cookie, so the site used to serve everyone English — including the French
 * half of the guest list, on the one page they must use to get in.
 * `Accept-Language` is the only signal available at that point.
 *
 * The CDN half of this contract (`language=en|fr`) can't be exercised under the
 * node adapter, so it is asserted as a header, same as `query=lang` above.
 */
test.describe('Pre-login language detection', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('the CDN cache key includes the resolved language', async ({ page }) => {
    const response = await page.goto('/');
    const vary = response?.headers()['netlify-vary'];
    // Without this, the first visitor to warm a cold page pins their language
    // for every later visitor who shares the other cache-key components.
    expect(vary).toContain('language=en|fr');
  });

  test('a French browser gets the login page in French', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'fr-FR' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await context.close();
  });

  test('an English browser still gets English', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await context.close();
  });

  test('detection does not set a cookie — only an explicit choice does', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'fr-FR' });
    const page = await context.newPage();
    await page.goto('/');

    const langCookie = (await context.cookies()).find((c) => c.name === 'sargaux_lang');
    expect(
      langCookie,
      'a detected language must stay a guess, so login can still prefer the Notion country'
    ).toBeUndefined();
    await context.close();
  });

  test('an explicit choice beats the browser locale', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'fr-FR' });
    const page = await context.newPage();

    await page.goto('/?lang=en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // And the stored choice keeps winning on later plain navigations.
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await context.close();
  });
});
