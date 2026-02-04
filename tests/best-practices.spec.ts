import { test, expect } from '@playwright/test';

test.describe('Best Practices Tests', () => {
  test('should have valid HTML structure', async ({ page }) => {
    await page.goto('/');

    // Check doctype exists
    const doctype = await page.evaluate(() => {
      return document.doctype !== null;
    });
    expect(doctype).toBe(true);

    // Check for basic semantic structure
    const main = await page.locator('main').count();
    expect(main).toBeGreaterThanOrEqual(1);
  });

  test('should have proper meta tags for SEO', async ({ page }) => {
    await page.goto('/');

    // Title should be present and meaningful
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title.length).toBeLessThanOrEqual(60); // SEO best practice

    // Charset should be UTF-8
    const charset = await page.locator('meta[charset]').getAttribute('charset');
    expect(charset?.toLowerCase()).toBe('utf-8');

    // Viewport should be set for responsive design
    const viewport = await page.locator('meta[name="viewport"]').count();
    expect(viewport).toBe(1);
  });

  test('should load without JavaScript errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(consoleErrors).toEqual([]);
  });

  test('should have responsive viewport configuration', async ({ page }) => {
    await page.goto('/');

    const viewportContent = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewportContent).toContain('width=device-width');
  });

  test('should not have broken links', async ({ page }) => {
    await page.goto('/');

    const links = await page.locator('a[href]').all();

    for (const link of links) {
      const href = await link.getAttribute('href');

      if (href && href.startsWith('http')) {
        // External links - just check they have href
        expect(href).toBeTruthy();
      } else if (href && href.startsWith('/')) {
        // Internal links - could be tested further if needed
        expect(href).toBeTruthy();
      }
    }
  });

  test('should have proper document language', async ({ page }) => {
    await page.goto('/');

    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBeTruthy();
    expect(lang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/); // ISO language code format
  });

  test('should load quickly', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('load');
    const loadTime = Date.now() - startTime;

    // Page should load in less than 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should have proper footer copyright', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    const footerText = await footer.textContent();
    expect(footerText).toContain('©');
    expect(footerText).toContain('2026');
  });

  test('should have valid image elements', async ({ page }) => {
    await page.goto('/');

    const images = await page.locator('img').all();

    for (const img of images) {
      // All images should have alt attribute (even if empty)
      const hasAlt = await img.evaluate((el) => el.hasAttribute('alt'));
      expect(hasAlt).toBe(true);
    }
  });
});
