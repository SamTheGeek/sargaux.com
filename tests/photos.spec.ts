import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { TEST_GUEST_NAME } from './fixtures';

/*
  NYC photo galleries. playwright.config.ts builds with PHOTOS_TEST_FIXTURE, so
  `afterparty` holds the invented photos in src/content/nycPhotos/fixture.json,
  `celebration` those in fixture-celebration.json, `preparation` is empty (and
  must stay hidden), and /api/photos answers with placeholder SVGs instead of
  resolving iCloud URLs.
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
const celebrationFixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../src/content/nycPhotos/fixture-celebration.json'), 'utf8')
) as FixturePhoto[];

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

  test('galleries with photos render on /nyc in configured order; empty ones are hidden', async ({ page }) => {
    await login(page);
    await page.goto('/nyc');
    const ids = await page.$$eval('[data-gallery-preview]', (els) =>
      els.map((el) => (el as HTMLElement).dataset.galleryPreview)
    );
    // Configured order is celebration, preparation, afterparty; preparation has no photos here.
    expect(ids).toEqual(['celebration', 'afterparty']);
    await expect(page.locator('[data-gallery-preview="celebration"] .nyc-strip-title')).toHaveText(/celebration/i);
  });

  test('each preview links to its own gallery, which names downloads after it', async ({ page }) => {
    await login(page);
    await page.goto('/nyc');
    await page.click('[data-gallery-preview="celebration"] .nyc-photos-heading');
    await page.waitForURL(/\/nyc\/photos\/celebration$/);
    await expect(page.locator('.photo-gallery-item')).toHaveCount(celebrationFixture.length);
    const first = page.locator('.photo-gallery-item').first();
    const guid = (await first.getAttribute('data-photo-guid'))!;
    const position = celebrationFixture.findIndex((p) => p.guid === guid) + 1;
    await expect(first).toHaveAttribute('data-download-name', `sargaux-nyc-celebration-${String(position).padStart(3, '0')}.svg`);
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

    // The URL and focus update once the open zoom has settled, not in its
    // first frame (see PhotoLightbox), so poll for them.
    const photoParam = () => new URL(page.url()).searchParams.get('photo');

    await items.nth(1).click();
    await expect(page.locator('#photo-lightbox')).toHaveClass(/active/);
    await expect(page.locator('.photo-lightbox-close')).toBeFocused();
    await expect.poll(photoParam).toBe(second);

    await page.keyboard.press('ArrowRight');
    await expect.poll(photoParam).toBe(third);

    await page.keyboard.press('Escape');
    await expect(page.locator('#photo-lightbox')).not.toHaveClass(/active/);
    await expect.poll(photoParam).toBeNull();
    await expect(items.nth(2)).toBeFocused();
  });

  test('tapping a tile opens the lightbox in place, never a ClientRouter navigation', async ({ page }) => {
    await login(page);
    for (const path of ['/nyc/photos/afterparty', '/nyc']) {
      await page.goto(path);
      await page.evaluate(() => {
        (window as unknown as { __navs: number }).__navs = 0;
        document.addEventListener('astro:before-preparation', () => {
          (window as unknown as { __navs: number }).__navs++;
        });
      });
      await page.locator('.photo-gallery-item').first().click();
      await expect(page.locator('#photo-lightbox')).toHaveClass(/active/);
      await page.waitForTimeout(600);
      expect(await page.evaluate(() => (window as unknown as { __navs: number }).__navs), path).toBe(0);
      await page.keyboard.press('Escape');
    }
  });

  test('opening the lightbox defers the URL update until the zoom ends', async ({ page }) => {
    await login(page);
    await page.goto('/nyc/photos/afterparty');
    // Record the URL in the same task as the click, i.e. the zoom's first frame.
    const urlAtOpen = await page.evaluate(() => {
      document.querySelectorAll<HTMLElement>('.photo-gallery-item')[1].click();
      return location.search;
    });
    expect(urlAtOpen).not.toContain('photo=');
    await expect.poll(() => new URL(page.url()).searchParams.has('photo')).toBe(true);
  });

  test('the page underneath never moves: no body lock, no scroll on step or wheel', async ({ page }) => {
    await login(page);
    await page.goto('/nyc/photos/afterparty');
    await page.evaluate(() => window.scrollTo(0, 300));
    const items = page.locator('.photo-gallery-item');
    await items.nth(1).click();
    const lightbox = page.locator('#photo-lightbox');
    await expect(lightbox).toHaveClass(/active/);
    await expect(page.locator('.photo-lightbox-close')).toBeFocused();

    const bodyStyle = await page.evaluate(() => ({
      overflow: document.body.style.overflow,
      paddingRight: document.body.style.paddingRight,
    }));
    expect(bodyStyle).toEqual({ overflow: '', paddingRight: '' });
    await expect(lightbox).toHaveAttribute('data-elastic-ignore', '');
    await expect(lightbox).toHaveCSS('touch-action', 'none');

    const scrollY = () => page.evaluate(() => window.scrollY);
    const before = await scrollY();
    await page.mouse.move(200, 400);
    await page.mouse.wheel(0, 600);
    await page.keyboard.press('PageDown');
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    expect(await scrollY()).toBe(before);
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
    // An afterparty GUID under the celebration path: galleries don't share photos.
    for (const path of [`/api/photos/afterparty/NOT-IN-MANIFEST-0000`, `/api/photos/celebration/${guid}`, `/api/photos/preparation/${guid}`, `/api/photos/nope/${guid}`]) {
      const res = await page.request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(404);
    }
  });
});

test.describe('Photo downloads', () => {
  test.skip(!weddingSiteEnabled, 'Wedding site must be enabled');

  const downloadHref = (guid: string) => `/api/photos/afterparty/${guid}/download`;
  /** 1-based place in the whole gallery, matching downloadFilename(). */
  const fileFor = (guid: string) =>
    `sargaux-nyc-afterparty-${String(fixture.findIndex((p) => p.guid === guid) + 1).padStart(3, '0')}.svg`;

  test('the lightbox offers a download for the photo on screen, and follows ←/→', async ({ page }) => {
    await login(page);
    await page.goto('/nyc/photos/afterparty');
    const items = page.locator('.photo-gallery-item');
    const download = page.locator('.photo-lightbox-download');

    await items.nth(1).click();
    await expect(download).toBeVisible();
    const second = (await items.nth(1).getAttribute('data-photo-guid'))!;
    await expect(download).toHaveAttribute('href', downloadHref(second));
    await expect(download).toHaveAttribute('download', fileFor(second));
    await expect(download).toHaveAttribute('aria-label', /download/i);

    await page.keyboard.press('ArrowRight');
    const third = (await items.nth(2).getAttribute('data-photo-guid'))!;
    await expect(download).toHaveAttribute('href', downloadHref(third));
    await expect(download).toHaveAttribute('download', fileFor(third));

    // Reachable in the dialog's Tab cycle.
    await expect(page.locator('.photo-lightbox-close')).toBeFocused();
    let reached = false;
    for (let i = 0; i < 5 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await download.evaluate((el) => el === document.activeElement);
    }
    expect(reached).toBe(true);
  });

  test('a preview tile on /nyc names its download by its place in the whole gallery', async ({ page }) => {
    await login(page);
    await page.goto('/nyc');
    const tile = page.locator('[data-gallery-preview="afterparty"] .photo-gallery-item').first();
    const guid = (await tile.getAttribute('data-photo-guid'))!;
    await expect(tile).toHaveAttribute('data-download-name', fileFor(guid));
  });

  test('desktop: download sits bottom-right, in the same column as close', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await page.goto('/nyc/photos/afterparty');
    await page.locator('.photo-gallery-item').nth(1).click();
    await expect(page.locator('.photo-lightbox-close')).toBeFocused();
    const close = (await page.locator('.photo-lightbox-close').boundingBox())!;
    const dl = (await page.locator('.photo-lightbox-download').boundingBox())!;
    expect(Math.abs(dl.x + dl.width - (close.x + close.width))).toBeLessThanOrEqual(1);
    expect(900 - (dl.y + dl.height)).toBeLessThanOrEqual(40);
  });

  test('phone: download keeps the bottom-right corner, ‹ › pair up bottom-left', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto('/nyc/photos/afterparty');
    await page.locator('.photo-gallery-item').nth(1).click();
    await expect(page.locator('.photo-lightbox-close')).toBeFocused();
    const dl = (await page.locator('.photo-lightbox-download').boundingBox())!;
    const prev = (await page.locator('.photo-lightbox-prev').boundingBox())!;
    const next = (await page.locator('.photo-lightbox-next').boundingBox())!;
    expect(dl.x).toBeGreaterThan(390 / 2);
    expect(844 - (dl.y + dl.height)).toBeLessThanOrEqual(40);
    expect(prev.x + prev.width).toBeLessThanOrEqual(390 / 2);
    expect(next.x + next.width).toBeLessThanOrEqual(390 / 2);
    expect(next.x).toBeGreaterThan(prev.x + prev.width);
    expect(Math.abs(next.y - dl.y)).toBeLessThanOrEqual(1);
  });

  test('the endpoint serves the original as a named attachment to a logged-in guest', async ({ page }) => {
    await login(page);
    const guid = fixture[3].guid;
    const res = await page.request.get(downloadHref(guid), { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-disposition']).toBe(`attachment; filename="${fileFor(guid)}"`);
  });

  test('the endpoint requires a session and a manifest photo', async ({ page, request }) => {
    const guid = fixture[0].guid;
    expect((await request.get(downloadHref(guid), { maxRedirects: 0 })).status()).toBe(401);
    await login(page);
    for (const path of [
      '/api/photos/afterparty/NOT-IN-MANIFEST-0000/download',
      `/api/photos/celebration/${guid}/download`,
      `/api/photos/preparation/${guid}/download`,
      `/api/photos/nope/${guid}/download`,
    ]) {
      expect((await page.request.get(path, { maxRedirects: 0 })).status(), path).toBe(404);
    }
  });

  test('desktop clicks are a plain download, not the share sheet', async ({ page }) => {
    await login(page);
    await page.goto('/nyc/photos/afterparty');
    await page.locator('.photo-gallery-item').nth(1).click();
    await expect(page.locator('.photo-lightbox-close')).toBeFocused();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('.photo-lightbox-download').click()]);
    expect(dl.suggestedFilename()).toMatch(/^sargaux-nyc-afterparty-\d{3}\.svg$/);
  });
});

test.describe('Photo downloads — preparing state on touch devices', () => {
  test.skip(!weddingSiteEnabled, 'Wedding site must be enabled');
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  /** Pretend the browser can share files, and record what gets shared. */
  async function stubShare(page: Page) {
    await page.addInitScript(() => {
      const w = window as unknown as { __shared: Array<{ name: string; type: string }> };
      w.__shared = [];
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (data: { files?: File[] }) => {
          for (const f of data.files ?? []) w.__shared.push({ name: f.name, type: f.type });
        },
      });
    });
  }

  /** Hold each download response for `ms`, always with a Content-Length. */
  async function slowDownloads(page: Page, ms: number) {
    await page.route('**/api/photos/**/download', async (route) => {
      const res = await route.fetch();
      const body = await res.body();
      await new Promise((r) => setTimeout(r, ms));
      await route.fulfill({ response: res, body, headers: { ...res.headers(), 'content-length': String(body.length) } });
    });
  }

  async function openPhoto(page: Page, n: number) {
    await login(page);
    await page.goto('/nyc/photos/afterparty');
    await page.locator('.photo-gallery-item').nth(n).tap();
    await expect(page.locator('#photo-lightbox')).toHaveClass(/active/);
  }

  test('the button shows a progress ring while the original downloads, then settles as ready', async ({ page }) => {
    await stubShare(page);
    await slowDownloads(page, 1500);
    await openPhoto(page, 1);
    const download = page.locator('.photo-lightbox-download');

    await expect(download).toHaveAttribute('data-state', 'loading');
    await expect(download).toHaveAttribute('aria-busy', 'true');
    await expect(download.locator('.photo-lightbox-progress')).toHaveCSS('opacity', '1');

    await expect(download).toHaveAttribute('data-state', 'ready', { timeout: 10_000 });
    await expect(download).not.toHaveAttribute('aria-busy', /.*/);
    expect(await download.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--progress'))).toBe('1');
  });

  test('stepping to another photo mid-download resets the ring and starts that photo', async ({ page }) => {
    await stubShare(page);
    await slowDownloads(page, 2500);
    await openPhoto(page, 1);
    const download = page.locator('.photo-lightbox-download');
    await expect(download).toHaveAttribute('data-state', 'loading');

    await page.locator('.photo-lightbox-next').tap();
    const third = (await page.locator('.photo-gallery-item').nth(2).getAttribute('data-photo-guid'))!;
    await expect(download).toHaveAttribute('href', `/api/photos/afterparty/${third}/download`);
    // Reset first (the old download was aborted), then the new photo's own load.
    await expect(download).toHaveAttribute('data-state', 'loading', { timeout: 5_000 });
    await expect(download).toHaveAttribute('data-state', 'ready', { timeout: 10_000 });
  });

  test('tapping while it is still preparing opens the share sheet once the file arrives', async ({ page }) => {
    await stubShare(page);
    await slowDownloads(page, 1500);
    await openPhoto(page, 1);
    const download = page.locator('.photo-lightbox-download');
    await expect(download).toHaveAttribute('data-state', 'loading');

    await download.tap();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __shared: Array<{ name: string }> }).__shared), {
        timeout: 10_000,
      })
      .toEqual([expect.objectContaining({ name: expect.stringMatching(/^sargaux-nyc-afterparty-\d{3}\.svg$/) })]);
    await expect(download).toHaveAttribute('data-state', 'ready');
  });
});

test.describe('Photo downloads — no preparing state on desktop', () => {
  test.skip(!weddingSiteEnabled, 'Wedding site must be enabled');

  test('desktop never prefetches, so the button stays idle', async ({ page }) => {
    let downloads = 0;
    await page.route('**/api/photos/**/download', (route) => {
      downloads++;
      return route.continue();
    });
    await login(page);
    await page.goto('/nyc/photos/afterparty');
    await page.locator('.photo-gallery-item').nth(1).click();
    await expect(page.locator('.photo-lightbox-close')).toBeFocused();
    await page.waitForTimeout(1200);
    await expect(page.locator('.photo-lightbox-download')).toHaveAttribute('data-state', 'idle');
    expect(downloads).toBe(0);
  });
});
