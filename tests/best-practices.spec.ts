import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

// Globals that exist in Node 24 but not in every browser guests use. URLPattern,
// for one, only reached Safari in version 26. Source in src/lib/ is shared
// between the server and client bundles, and the type environment includes both
// DOM and Node typings, so `astro check` can't tell when one of these leaks into
// a browser bundle. This scan of the built output can.
const SERVER_ONLY_GLOBALS = ['URLPattern', 'RegExp.escape', 'process.permission', 'Error.isError'];

// Client bundles land in dist/_astro under the Netlify adapter and in
// dist/client/_astro under the node adapter that the Playwright webServer builds with.
const CLIENT_BUNDLE_DIRS = ['dist/client/_astro', 'dist/_astro'];

test.describe('Best Practices Tests', () => {
  // One page load asserts everything about the logged-out homepage's markup;
  // separate tests would each pay for their own navigation to the same URL.
  test('homepage has valid structure, meta tags, and no console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(consoleErrors).toEqual([]);

    // Structure
    expect(await page.evaluate(() => document.doctype !== null)).toBe(true);
    expect(await page.locator('main').count()).toBeGreaterThanOrEqual(1);
    expect(await page.locator('html').getAttribute('lang')).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);

    // Meta tags
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title.length).toBeLessThanOrEqual(60); // SEO best practice
    expect((await page.locator('meta[charset]').getAttribute('charset'))?.toLowerCase()).toBe('utf-8');
    await expect(page.locator('meta[name="viewport"]')).toHaveCount(1);
    expect(await page.locator('meta[name="viewport"]').getAttribute('content')).toContain(
      'width=device-width'
    );

    // Footer
    const footerText = await page.locator('footer').textContent();
    expect(footerText).toContain('©');
    expect(footerText).toContain('2026');

    // Every image has an alt attribute (even if empty)
    const imagesMissingAlt = await page.locator('img').evaluateAll(
      (imgs) => imgs.filter((el) => !el.hasAttribute('alt')).length
    );
    expect(imagesMissingAlt).toBe(0);
  });
});

test.describe('Client bundles', () => {
  // Runs under the main config only, after the webServer build, so dist/ is
  // current. Not a unit spec: the unit config never builds.
  test('no server-only Node 24 globals in browser JavaScript', () => {
    const dir = CLIENT_BUNDLE_DIRS.find((d) => existsSync(d));
    expect(dir, 'no built client bundle directory; was the site built?').toBeDefined();

    const files = readdirSync(dir!).filter((f) => f.endsWith('.js'));
    expect(files.length).toBeGreaterThan(0);

    const leaks = files.flatMap((file) => {
      const source = readFileSync(join(dir!, file), 'utf8');
      return SERVER_ONLY_GLOBALS.filter((name) => source.includes(name)).map((name) => `${file}: ${name}`);
    });
    expect(leaks).toEqual([]);
  });
});
