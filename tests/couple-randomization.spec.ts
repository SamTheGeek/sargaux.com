import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { TEST_GUEST_NAME } from './fixtures';

/**
 * The couple page re-draws every photo slot — the hero portrait and all eight
 * scattered gallery cards — on each request, so a refresh shows a different
 * set of photos. That is a deliberate product behavior, and it is unusually
 * easy to break invisibly.
 *
 * It regressed once already: adding `/couple` to `routeRules` in
 * astro.config.mjs (commit 0c75ac3, the Astro 7 / Netlify CDN caching upgrade)
 * froze one draw per guest for up to an hour of `maxAge` plus a day of `swr`.
 * Nothing failed, and nothing looked wrong locally — the CDN cache provider is
 * Netlify-only, so under the node adapter that dev and Playwright use,
 * `routeRules` are inert and the page keeps re-randomizing per request.
 *
 * So this file guards from both directions:
 *   - a live check that consecutive loads actually differ, and
 *   - a static check on the config, since the live check physically cannot
 *     observe the CDN behavior from a node-adapter run.
 */

const weddingSiteEnabled = process.env.FEATURE_GLOBAL_WEDDING_SITE_ENABLED === 'true';

/** Matches `couple_07` out of an optimized image URL, whatever the hash/format. */
const PHOTO_ID = /couple_\d+/g;

async function login(page: Page) {
  await page.goto('/');
  await page.click('#login-trigger');
  await page.fill('#name', TEST_GUEST_NAME);
  await page.press('#name', 'Enter');
  await page.waitForURL(/\/(nyc|france)$/);
}

/** The photo filenames rendered into the page, hero first, in DOM order. */
async function readPhotoIds(page: Page): Promise<string[]> {
  const srcs = await page
    .locator('.photo-card img')
    .evaluateAll((els) => els.map((el) => (el as HTMLImageElement).getAttribute('src') ?? ''));

  return srcs.map((src) => {
    const match = src.match(PHOTO_ID);
    if (!match) throw new Error(`Could not read a photo id out of image src: ${src}`);
    // The id can appear twice in one URL (`/_image?href=/_astro/couple_07.hash.jpeg`).
    return match[0];
  });
}

test.describe('Couple page — photo randomization', () => {
  test.skip(!weddingSiteEnabled, 'Wedding site must be enabled for couple page tests');
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;

  /** One reload per entry; each is the ordered list of photos that render. */
  const draws: string[][] = [];
  const DRAW_COUNT = 5;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await login(page);

    for (let i = 0; i < DRAW_COUNT; i++) {
      // A full navigation, not an SPA swap — this is the "refresh" case.
      await page.goto('/couple', { waitUntil: 'domcontentloaded' });
      draws.push(await readPhotoIds(page));
    }
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('every load renders one hero plus eight gallery photos', () => {
    for (const draw of draws) {
      expect(draw).toHaveLength(9);
    }
  });

  test('no photo is repeated within a single load', () => {
    for (const draw of draws) {
      expect(new Set(draw).size).toBe(draw.length);
    }
  });

  test('consecutive reloads render different photo selections', () => {
    // 42 photos into 9 ordered slots: two identical draws in a row is possible
    // in principle and never in practice. Comparing every load against the
    // first makes an accidental single collision harmless while still failing
    // hard the moment the selection is frozen.
    const [first, ...rest] = draws.map((draw) => draw.join(','));
    const differing = rest.filter((draw) => draw !== first);
    expect(
      differing.length,
      `All ${DRAW_COUNT} reloads rendered the identical photo set — the couple page is no longer randomizing.`
    ).toBeGreaterThan(0);
  });

  test('the photo pool is much wider than one page of slots', () => {
    // Guards against a regression where the pool collapses (e.g. a bad glob)
    // and "randomization" quietly reduces to reshuffling the same few photos.
    const seen = new Set(draws.flat());
    expect(seen.size).toBeGreaterThan(9);
  });

  test('the hero is drawn from the portrait-only pool', async () => {
    // Read the width/height attributes rather than natural dimensions so this
    // does not depend on the image having finished downloading.
    const { width, height } = await page.locator('.couple-panel img').first().evaluate((el) => {
      const img = el as HTMLImageElement;
      return { width: img.width, height: img.height };
    });
    expect(height).toBeGreaterThan(width);
  });

  test('the hero photo never also appears in the gallery', () => {
    for (const [hero, ...gallery] of draws) {
      expect(gallery).not.toContain(hero);
    }
  });
});

test.describe('Couple page — CDN cache guard', () => {
  /**
   * This is the check the browser tests cannot make. `cache: { provider }` is
   * only configured for the Netlify adapter, so a node-adapter Playwright run
   * never sees CDN caching and would happily pass with `/couple` cached in
   * production. Assert against the config itself instead.
   */
  test('/couple is not in routeRules', async () => {
    const { default: config } = await import('../astro.config.mjs');
    const routeRules = (config.routeRules ?? {}) as Record<string, unknown>;

    expect(
      Object.keys(routeRules),
      'Caching /couple freezes its randomized photo selection per guest for the whole cache window.'
    ).not.toContain('/couple');
  });

  test('the pages that are cached are still cached', async () => {
    // The fix for the randomization bug was removing one entry, not disabling
    // CDN caching. If this list empties out, something over-corrected.
    const { default: config } = await import('../astro.config.mjs');
    const routeRules = (config.routeRules ?? {}) as Record<string, unknown>;

    for (const route of ['/nyc', '/france', '/registry']) {
      expect(Object.keys(routeRules)).toContain(route);
    }
  });
});
