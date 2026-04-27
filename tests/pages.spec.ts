import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { TEST_GUEST_NAME } from './fixtures';

const weddingSiteEnabled = process.env.FEATURE_GLOBAL_WEDDING_SITE_ENABLED === 'true';

async function login(page: Page) {
  await page.goto('/');
  await page.click('#login-trigger');
  await page.fill('#name', TEST_GUEST_NAME);
  await page.press('#name', 'Enter');
  await page.waitForURL(/\/(nyc|france)$/);
}

// ── 1. Back links ─────────────────────────────────────────────────────────────

test.describe('Back links ("Return to event")', () => {
  test.skip(!weddingSiteEnabled, 'Wedding site must be enabled for back-link tests');
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  const subPages: Array<{ path: string; selector: string }> = [
    // NYC pages — hero uses .details-back, RSVP uses .back-link
    { path: '/nyc/details',  selector: '.details-back' },
    { path: '/nyc/travel',   selector: '.details-back' },
    { path: '/nyc/lookbook', selector: '.details-back' },
    { path: '/nyc/rsvp',     selector: '.back-link'    },
    // France pages — all use .back-link in the header nav
    { path: '/france/details',  selector: '.back-link' },
    { path: '/france/travel',   selector: '.back-link' },
    { path: '/france/lookbook', selector: '.back-link' },
    { path: '/france/rsvp',     selector: '.back-link' },
    { path: '/france/schedule', selector: '.back-link' },
  ];

  for (const { path, selector } of subPages) {
    test(`${path} shows "← Return to event" back link`, async () => {
      await page.goto(path);
      const backLink = page.locator(selector).first();
      await expect(backLink).toBeVisible();
      await expect(backLink).toContainText('← Return to event');
    });
  }
});

// ── 2. NYC Travel page — hotels section ───────────────────────────────────────

test.describe('NYC Travel page — hotels section', () => {
  test.skip(!weddingSiteEnabled, 'Wedding site must be enabled for travel page tests');
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await login(page);
    await page.goto('/nyc/travel');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('page renders with an h1', async () => {
    await expect(page.locator('h1')).toBeVisible();
  });

  test('"Arlo Williamsburg" hotel is visible', async () => {
    await expect(page.locator('text=Arlo Williamsburg')).toBeVisible();
  });

  test('"Book now" link for Arlo Williamsburg is visible and has an href', async () => {
    const arloRow = page.locator('.nyc-info-row').filter({ hasText: /Arlo Williamsburg/i });
    const bookNow = arloRow.getByRole('link', { name: /Book now/i });
    await expect(bookNow).toBeVisible();
    const href = await bookNow.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).toContain('synxis.com');
  });

  test('"Getting There" section heading is visible', async () => {
    // The section band heading comes from strings.nyc.travel.gettingThere.heading
    const gettingThereHeading = page.locator('.details-band').filter({ hasText: /getting there/i });
    await expect(gettingThereHeading).toBeVisible();
  });

  test('"By Bike" row mentioning CitiBike is present', async () => {
    await expect(page.locator('text=By Bike')).toBeVisible();
    await expect(page.locator('text=CitiBike')).toBeVisible();
  });

  test('"By Subway" row is present', async () => {
    await expect(page.locator('text=By Subway')).toBeVisible();
  });

  test('Wythe Hotel is visible by default', async () => {
    test.skip(process.env.FEATURE_NYC_WYTHE_SOLD_OUT === 'true', 'Wythe is marked sold out — hotel is expected to be hidden');
    await expect(page.locator('.nyc-info-key', { hasText: 'Wythe Hotel' })).toBeVisible();
  });
});

// ── 3. RSVP preview mode ──────────────────────────────────────────────────────

const rsvpPreviewEnabled =
  process.env.FEATURE_NYC_RSVP_PREVIEW === 'true' &&
  process.env.FEATURE_GLOBAL_NOTION_BACKEND !== 'true';

test.describe('RSVP preview mode — NYC', () => {
  test.skip(!rsvpPreviewEnabled, 'RSVP preview mode requires FEATURE_NYC_RSVP_PREVIEW=true and Notion backend off');
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('NYC RSVP form renders with mock data (not the notion-required error card)', async () => {
    await page.goto('/nyc/rsvp');
    await expect(page.locator('[data-testid="notion-required"]')).not.toBeVisible();
    await expect(page.locator('#rsvp-form')).toBeVisible();
  });

  test('NYC RSVP has at least one [data-guest-row]', async () => {
    await page.goto('/nyc/rsvp');
    const count = await page.locator('[data-guest-row]').count();
    expect(count).toBeGreaterThan(0);
  });

  test('NYC RSVP guest names include "Sam Gross" and "Margaux Ancel"', async () => {
    await page.goto('/nyc/rsvp');
    const nameInputs = page.locator('[data-guest-row] .guest-name');
    const values = await nameInputs.evaluateAll((inputs) =>
      inputs.map((el) => (el as HTMLInputElement).value)
    );
    expect(values).toContain('Sam Gross');
    expect(values).toContain('Margaux Ancel');
  });

  test('NYC RSVP has at least one .event-checkbox in the core events section', async () => {
    await page.goto('/nyc/rsvp');
    const count = await page.locator('.event-checkbox').count();
    expect(count).toBeGreaterThan(0);
  });

  test('France RSVP form also renders with mock data', async () => {
    await page.goto('/france/rsvp');
    await expect(page.locator('[data-testid="notion-required"]')).not.toBeVisible();
    await expect(page.locator('#rsvp-form')).toBeVisible();
  });
});

// ── 4. Lookbook pages — disc-as-O heading ─────────────────────────────────────

test.describe('Lookbook pages — disc-as-O heading', () => {
  test.skip(!weddingSiteEnabled, 'Wedding site must be enabled for lookbook disc tests');
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  // ── NYC lookbook ────────────────────────────────────────────────────────────

  test('NYC: h1 contains .lookbook-disc-slot with disc and ghost O', async () => {
    await page.goto('/nyc/lookbook');
    await expect(page.locator('h1 .lookbook-disc-slot')).toBeVisible();
    await expect(page.locator('h1 .lookbook-disc-slot .nyc-disc')).toBeAttached();
    await expect(page.locator('h1 .lookbook-disc-slot .lookbook-o-ghost')).toBeAttached();
  });

  test('NYC: ghost O is visibility:hidden', async () => {
    await page.goto('/nyc/lookbook');
    const visibility = await page.locator('.lookbook-o-ghost').evaluate(
      (el) => window.getComputedStyle(el).visibility
    );
    expect(visibility).toBe('hidden');
  });

  test('NYC: disc has position:absolute', async () => {
    await page.goto('/nyc/lookbook');
    const position = await page.locator('.lookbook-disc-slot .nyc-disc').evaluate(
      (el) => window.getComputedStyle(el).position
    );
    expect(position).toBe('absolute');
  });

  test('NYC: disc height is at least 90% of adjacent cap letter height', async () => {
    await page.goto('/nyc/lookbook');
    const { discHeight, capHeight } = await page.evaluate(() => {
      const disc = document.querySelector('.lookbook-disc-slot .nyc-disc') as HTMLElement;
      const h1 = document.querySelector('.lookbook-heading') as HTMLElement;

      // Measure a cap letter span (e.g. "LO" or "KBOOK") for actual rendered height
      const spans = Array.from(h1.querySelectorAll('span[aria-hidden="true"]'))
        .filter((el) => (el as HTMLElement).textContent?.trim());
      const capSpan = spans[0] as HTMLElement;

      const capRect = capSpan.getBoundingClientRect();
      const discRect = disc.getBoundingClientRect();

      // Use canvas to measure actual cap height
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const style = window.getComputedStyle(h1);
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics = ctx.measureText('L');
      const measuredCapHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

      return {
        discHeight: discRect.height,
        capHeight: measuredCapHeight > 0 ? measuredCapHeight : capRect.height,
      };
    });

    expect(discHeight).toBeGreaterThan(0);
    expect(discHeight).toBeGreaterThanOrEqual(capHeight * 0.9);
  });

  test('NYC: disc vertical center is within ±8px of adjacent cap letter vertical center', async () => {
    await page.goto('/nyc/lookbook');
    const { discMidY, capMidY } = await page.evaluate(() => {
      const disc = document.querySelector('.lookbook-disc-slot .nyc-disc') as HTMLElement;
      const h1 = document.querySelector('.lookbook-heading') as HTMLElement;
      const capSpan = Array.from(h1.querySelectorAll('span[aria-hidden="true"]'))
        .find((el) => (el as HTMLElement).textContent?.trim()) as HTMLElement;

      const discRect = disc.getBoundingClientRect();
      const capRect = capSpan.getBoundingClientRect();

      return {
        discMidY: discRect.top + discRect.height / 2,
        capMidY: capRect.top + capRect.height / 2,
      };
    });

    expect(Math.abs(discMidY - capMidY)).toBeLessThanOrEqual(8);
  });

  // ── France lookbook ─────────────────────────────────────────────────────────

  test('France: h1 contains .lookbook-disc-slot with disc and ghost O', async () => {
    await page.goto('/france/lookbook');
    await expect(page.locator('h1 .lookbook-disc-slot')).toBeVisible();
    await expect(page.locator('h1 .lookbook-disc-slot .lookbook-disc')).toBeAttached();
    await expect(page.locator('h1 .lookbook-disc-slot .lookbook-o-ghost')).toBeAttached();
  });

  test('France: ghost O is visibility:hidden', async () => {
    await page.goto('/france/lookbook');
    const visibility = await page.locator('.lookbook-o-ghost').evaluate(
      (el) => window.getComputedStyle(el).visibility
    );
    expect(visibility).toBe('hidden');
  });

  test('France: disc has position:absolute', async () => {
    await page.goto('/france/lookbook');
    const position = await page.locator('.lookbook-disc-slot .lookbook-disc').evaluate(
      (el) => window.getComputedStyle(el).position
    );
    expect(position).toBe('absolute');
  });

  test('France: disc height is at least 90% of adjacent cap letter height', async () => {
    await page.goto('/france/lookbook');
    const { discHeight, capHeight } = await page.evaluate(() => {
      const disc = document.querySelector('.lookbook-disc-slot .lookbook-disc') as HTMLElement;
      const h1 = document.querySelector('.lookbook-heading') as HTMLElement;

      const capSpan = Array.from(h1.querySelectorAll('span[aria-hidden="true"]'))
        .find((el) => (el as HTMLElement).textContent?.trim()) as HTMLElement;

      const capRect = capSpan.getBoundingClientRect();
      const discRect = disc.getBoundingClientRect();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const style = window.getComputedStyle(h1);
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics = ctx.measureText('L');
      const measuredCapHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

      return {
        discHeight: discRect.height,
        capHeight: measuredCapHeight > 0 ? measuredCapHeight : capRect.height,
      };
    });

    expect(discHeight).toBeGreaterThan(0);
    expect(discHeight).toBeGreaterThanOrEqual(capHeight * 0.9);
  });

  test('France: disc vertical center is within ±8px of adjacent cap letter vertical center', async () => {
    await page.goto('/france/lookbook');
    const { discMidY, capMidY } = await page.evaluate(() => {
      const disc = document.querySelector('.lookbook-disc-slot .lookbook-disc') as HTMLElement;
      const h1 = document.querySelector('.lookbook-heading') as HTMLElement;
      const capSpan = Array.from(h1.querySelectorAll('span[aria-hidden="true"]'))
        .find((el) => (el as HTMLElement).textContent?.trim()) as HTMLElement;

      const discRect = disc.getBoundingClientRect();
      const capRect = capSpan.getBoundingClientRect();

      return {
        discMidY: discRect.top + discRect.height / 2,
        capMidY: capRect.top + capRect.height / 2,
      };
    });

    expect(Math.abs(discMidY - capMidY)).toBeLessThanOrEqual(8);
  });
});

// ── 5. NYC mobile layout — no horizontal scroll, sticky header ───────────────

test.describe('NYC mobile layout', () => {
  test.skip(!weddingSiteEnabled, 'Wedding site must be enabled for NYC mobile layout tests');
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    page = await context.newPage();
    await login(page);
    await page.goto('/nyc');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('html has overflow-x:clip to block horizontal scroll', async () => {
    // The skyline intentionally bleeds 5px on each side (width: calc(100% + 10px)),
    // so scrollWidth > clientWidth by design. The fix is overflow-x:clip on <html>
    // (clips without creating a scroll container, preserving position:sticky) plus
    // touch-action:pan-y on body (blocks horizontal touch gestures on iOS Safari).
    const overflowX = await page.evaluate(() =>
      getComputedStyle(document.documentElement).overflowX
    );
    expect(overflowX).toBe('clip');
  });

  test('body has touch-action:pan-y to block horizontal touch gestures', async () => {
    const touchAction = await page.evaluate(() =>
      getComputedStyle(document.body).touchAction
    );
    expect(touchAction).toBe('pan-y');
  });

  test('header remains at top of viewport after scrolling', async () => {
    // Scroll well past the fixed hero text into the skyline section
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(100); // let scroll settle

    const headerTop = await page.locator('.site-header').evaluate(
      (el) => el.getBoundingClientRect().top
    );
    // Allow a few pixels for border/subpixel rendering
    expect(headerTop).toBeGreaterThanOrEqual(-2);
    expect(headerTop).toBeLessThanOrEqual(2);
  });
});

// ── 6. Couple page — scattered gallery ────────────────────────────────────────

test.describe('Couple page — scattered gallery', () => {
  test.skip(!weddingSiteEnabled, 'Wedding site must be enabled for couple page tests');
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await login(page);
    await page.goto('/couple');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('page renders with an h1', async () => {
    await expect(page.locator('h1')).toBeVisible();
  });

  test('hero photo card (.photo-card) is present', async () => {
    await expect(page.locator('.photo-card').first()).toBeVisible();
  });

  test('gallery section (.couple-gallery) is present', async () => {
    await expect(page.locator('.couple-gallery')).toBeVisible();
  });

  test('exactly 8 .gallery-scatter-card elements are rendered', async () => {
    const count = await page.locator('.gallery-scatter-card').count();
    expect(count).toBe(8);
  });

  test('all gallery card images have non-empty alt attributes', async () => {
    const imgs = page.locator('.gallery-scatter-card img');
    const altValues = await imgs.evaluateAll((elements) =>
      elements.map((el) => (el as HTMLImageElement).alt)
    );
    for (const alt of altValues) {
      expect(alt.trim().length).toBeGreaterThan(0);
    }
  });

  test('each gallery card has a style attribute containing --rotate', async () => {
    const cards = page.locator('.gallery-scatter-card');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const style = await cards.nth(i).getAttribute('style');
      expect(style).toContain('--rotate');
    }
  });
});
