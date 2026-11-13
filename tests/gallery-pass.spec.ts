import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

/*
  Gallery pass (QR code on the mailed photo cards): /p/{code} opens /nyc and the
  gallery pages without a login, and nothing else. Playwright builds with
  PHOTOS_TEST_FIXTURE, the only build that accepts the invented code below, so
  the real code never has to be in this public repository.
*/
const weddingSiteEnabled = process.env.FEATURE_GLOBAL_WEDDING_SITE_ENABLED === 'true';
const TEST_CODE = 'test-gallery-pass-code';
const fixture: { guid: string }[] = JSON.parse(
  readFileSync(join(import.meta.dirname, '../src/content/nycPhotos/fixture.json'), 'utf8')
);

test.describe('Gallery pass', () => {
  test.skip(!weddingSiteEnabled, 'Wedding site must be enabled');

  test('an unknown code lands on the login and sets no pass', async ({ page, context }) => {
    await page.goto('/p/not-a-real-code-123');
    expect(new URL(page.url()).pathname).toBe('/');
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'sargaux_gallery')).toBeUndefined();
  });

  test('a live code opens /nyc with the galleries and no France toggle', async ({ page }) => {
    await page.goto(`/p/${TEST_CODE}`);
    expect(new URL(page.url()).pathname).toBe('/nyc');
    await expect(page.locator('[data-gallery-preview="afterparty"]')).toBeVisible();
    await expect(page.locator('.event-toggle')).toHaveCount(0);
    await expect(page.locator('.guest-name')).toHaveCount(0);
  });

  test('the pass opens a gallery page and its photos', async ({ page }) => {
    await page.goto(`/p/${TEST_CODE}`);
    const gallery = await page.goto('/nyc/photos/afterparty');
    expect(gallery?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe('/nyc/photos/afterparty');

    const photo = await page.request.get(`/api/photos/afterparty/${fixture[0].guid}?size=thumb`, {
      maxRedirects: 0,
    });
    expect(photo.status()).toBe(200);
  });

  test('every other page still asks for a login', async ({ page }) => {
    await page.goto(`/p/${TEST_CODE}`);
    for (const path of ['/nyc/faq', '/nyc/details', '/nyc/rsvp', '/couple', '/france', '/registry']) {
      await page.goto(path);
      const landed = new URL(page.url());
      expect(landed.pathname, path).toBe('/');
      expect(landed.searchParams.get('next'), path).toBe(path);
    }
  });

  test('without the pass the photo API still refuses', async ({ request }) => {
    const photo = await request.get(`/api/photos/afterparty/${fixture[0].guid}?size=thumb`, {
      maxRedirects: 0,
    });
    expect(photo.status()).toBe(401);
  });
});
