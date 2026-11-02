import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { TEST_GUEST_NAME } from './fixtures';

/*
  NYC photo galleries. playwright.config.ts builds with PHOTOS_TEST_FIXTURE, so
  `afterparty` holds the invented photos in src/content/nycPhotos/fixture.json,
  `preparation` and `event` are empty (and must stay hidden), and /api/photos
  answers with placeholder SVGs instead of resolving iCloud URLs.
*/

const weddingSiteEnabled = process.env.FEATURE_GLOBAL_WEDDING_SITE_ENABLED === 'true';

interface FixturePhoto {
  guid: string;
  takenAt: string;
  featured?: boolean;
}
const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../src/content/nycPhotos/fixture.json'), 'utf8')
) as FixturePhoto[];
const featured = fixture.filter((p) => p.featured);

async function login(page: Page) {
  const res = await page.request.post('/api/login', { form: { name: TEST_GUEST_NAME } });
  expect(res.ok()).toBe(true);
}

test.describe('NYC photo galleries', () => {
  test.skip(!weddingSiteEnabled, 'Wedding site must be enabled');

  test('/nyc shows the Photos band between the info table and Explore', async ({ page }) => {
    await login(page);
    await page.goto('/nyc');
    const order = await page.$$eval('.nyc-info, .nyc-photos-band, .nyc-photos, .nyc-explore-band:not(.nyc-photos-band)', (els) =>
      els.map((el) => (el.classList.contains('nyc-info') ? 'info' : el.classList.contains('nyc-photos-band') ? 'band' : el.classList.contains('nyc-photos') ? 'photos' : 'explore'))
    );
    expect(order).toEqual(['info', 'band', 'photos', 'explore']);
  });

  test('post-event layout hides dress code, RSVP deadline, and the Travel/RSVP Explore rows', async ({ page }) => {
    await login(page);
    await page.goto('/nyc');
    await expect(page.locator('.nyc-info-row')).toHaveCount(2);
    await expect(page.locator('.nyc-info .nyc-info-link-inline[href="/nyc/rsvp"]')).toHaveCount(0);
    await expect(page.locator('.nyc-nav .nyc-strip-link[href="/nyc/travel"]')).toHaveCount(0);
    await expect(page.locator('.nyc-nav .nyc-strip-link[href="/nyc/rsvp"]')).toHaveCount(0);
    await expect(page.locator('.nyc-nav .nyc-strip-link[href="/nyc/details"]')).toHaveCount(1);
  });

  test('only galleries with photos render on /nyc', async ({ page }) => {
    await login(page);
    await page.goto('/nyc');
    await expect(page.locator('[data-gallery-preview]')).toHaveCount(1);
    await expect(page.locator('[data-gallery-preview="afterparty"]')).toBeVisible();
  });

  test('the preview shows the featured photos, oldest first', async ({ page }) => {
    await login(page);
    await page.goto('/nyc');
    const guids = await page.$$eval('[data-gallery-preview="afterparty"] .photo-gallery-item', (els) =>
      els.map((el) => (el as HTMLElement).dataset.photoGuid)
    );
    // The first-row fix-up may swap a tall/wide photo, but the set is exact.
    expect(new Set(guids)).toEqual(new Set(featured.map((p) => p.guid)));
    expect(guids).toHaveLength(featured.length);
  });

  test('"See all" opens the full gallery page', async ({ page }) => {
    await login(page);
    await page.goto('/nyc');
    await page.click('[data-gallery-preview="afterparty"] .nyc-photos-heading');
    await page.waitForURL(/\/nyc\/photos\/afterparty$/);
    await expect(page.locator('.details-back')).toHaveAttribute('href', '/nyc');
  });

  test('the full gallery lists every photo oldest first', async ({ page }) => {
    await login(page);
    await page.goto('/nyc/photos/afterparty');
    const guids = await page.$$eval('.photo-gallery-item', (els) => els.map((el) => (el as HTMLElement).dataset.photoGuid));
    expect(guids).toHaveLength(fixture.length);
    const byTime = [...fixture].sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt)).map((p) => p.guid);
    // Everything after the first row keeps strict chronological order.
    expect(guids.slice(6)).toEqual(byTime.slice(6));
  });

  test('empty and unknown galleries 404', async ({ page }) => {
    await login(page);
    for (const path of ['/nyc/photos/event', '/nyc/photos/preparation', '/nyc/photos/nope']) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
    }
  });

  test('the lightbox opens, steps with the arrow keys, and closes with Escape', async ({ page }) => {
    await login(page);
    await page.goto('/nyc/photos/afterparty');
    const items = page.locator('.photo-gallery-item');
    const second = await items.nth(1).getAttribute('data-photo-guid');
    const third = await items.nth(2).getAttribute('data-photo-guid');

    await items.nth(1).click();
    await expect(page.locator('#photo-lightbox')).toHaveClass(/active/);
    await expect(page.locator('.photo-lightbox-close')).toBeFocused();
    expect(new URL(page.url()).searchParams.get('photo')).toBe(second);

    await page.keyboard.press('ArrowRight');
    expect(new URL(page.url()).searchParams.get('photo')).toBe(third);

    await page.keyboard.press('Escape');
    await expect(page.locator('#photo-lightbox')).not.toHaveClass(/active/);
    expect(new URL(page.url()).searchParams.has('photo')).toBe(false);
    await expect(items.nth(2)).toBeFocused();
  });

  test('a ?photo= link opens that photo', async ({ page }) => {
    await login(page);
    const guid = fixture[fixture.length - 1].guid;
    await page.goto(`/nyc/photos/afterparty?photo=${guid}`);
    await expect(page.locator('#photo-lightbox')).toHaveClass(/active/);
    await expect(page.locator('.photo-lightbox-next')).toBeHidden();
  });
});

test.describe('NYC photo galleries — accessibility', () => {
  test.skip(!weddingSiteEnabled, 'Wedding site must be enabled');
  const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

  test('the gallery page has no detectable issues', async ({ page }) => {
    await login(page);
    await page.goto('/nyc/photos/afterparty');
    // The shared NYC footer (40%-opacity cream on moss) fails contrast on every
    // NYC page; that predates the gallery and is tracked separately.
    const results = await new AxeBuilder({ page }).exclude('footer').withTags(tags).analyze();
    expect(results.violations).toEqual([]);
  });

  test('the open lightbox has no detectable issues', async ({ page }) => {
    await login(page);
    await page.goto('/nyc/photos/afterparty');
    await page.locator('.photo-gallery-item').first().click();
    await expect(page.locator('#photo-lightbox')).toHaveClass(/active/);
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page }).include('#photo-lightbox').withTags(tags).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('/api/photos', () => {
  test.skip(!weddingSiteEnabled, 'Wedding site must be enabled');
  const guid = fixture[0].guid;

  test('requires a session', async ({ request }) => {
    const res = await request.get(`/api/photos/afterparty/${guid}`, { maxRedirects: 0 });
    expect(res.status()).toBe(401);
  });

  test('serves a manifest photo to a logged-in guest', async ({ page }) => {
    await login(page);
    const res = await page.request.get(`/api/photos/afterparty/${guid}?size=full`, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/svg+xml');
  });

  test('rejects GUIDs that are not in the gallery manifest', async ({ page }) => {
    await login(page);
    for (const path of [`/api/photos/afterparty/NOT-IN-MANIFEST-0000`, `/api/photos/event/${guid}`, `/api/photos/nope/${guid}`]) {
      const res = await page.request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(404);
    }
  });
});
