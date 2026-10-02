import { test, expect } from '@playwright/test';

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
