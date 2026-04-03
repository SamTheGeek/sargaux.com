import { test, expect, type BrowserContext, type Page } from '@playwright/test';

const TEST_GUEST_NAME = 'Sam Gross'; // Must exist in Notion Guest List

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
    { path: '/nyc/details', selector: '.details-back' },
    { path: '/nyc/travel',  selector: '.details-back' },
    { path: '/nyc/rsvp',    selector: '.back-link'    },
    // France pages — all use .back-link in the header nav
    { path: '/france/details',  selector: '.back-link' },
    { path: '/france/travel',   selector: '.back-link' },
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
    await expect(page.locator('text=Wythe Hotel')).toBeVisible();
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

// ── 4. Couple page — scattered gallery ────────────────────────────────────────

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

  test('exactly 6 .gallery-scatter-card elements are rendered', async () => {
    const count = await page.locator('.gallery-scatter-card').count();
    expect(count).toBe(6);
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
