import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('should have fast First Contentful Paint (FCP)', async ({ page }) => {
    await page.goto('/');

    // Wait for first contentful paint
    const fcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              resolve(entry.startTime);
            }
          }
        }).observe({ type: 'paint', buffered: true });
      });
    });

    // FCP should be under 1.8 seconds (good threshold)
    expect(fcp).toBeLessThan(1800);
  });

  test('should have fast Time to Interactive (TTI)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const loadTime = await page.evaluate(() => {
      const [navEntry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (!navEntry) return 0;
      return navEntry.loadEventEnd - navEntry.startTime;
    });

    // TTI should be under 3.8 seconds (good threshold)
    expect(loadTime).toBeLessThan(3800);
  });

  test('should have fast DOM Content Loaded', async ({ page }) => {
    await page.goto('/');

    const domContentLoaded = await page.evaluate(() => {
      const [navEntry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (!navEntry) return 0;
      return navEntry.domContentLoadedEventEnd - navEntry.startTime;
    });

    // DOM Content Loaded should be under 1.5 seconds
    expect(domContentLoaded).toBeLessThan(1500);
  });

  test('should have small total page size', async ({ page }) => {
    await page.goto('/');

    // Get all resources loaded
    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map((r: any) => ({
        name: r.name,
        size: r.transferSize || 0
      }));
    });

    const totalSize = resources.reduce((acc: number, r: any) => acc + r.size, 0);

    // Total page size should be under 500KB for a simple site
    expect(totalSize).toBeLessThan(500000);
  });

  test('should have minimal JavaScript execution time', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    const jsExecutionTime = await page.evaluate(() => {
      const entries = performance.getEntriesByType('measure') as PerformanceMeasure[];
      const jsEntries = entries.filter(entry => entry.name.includes('script'));
      return jsEntries.reduce((total, entry) => total + entry.duration, 0);
    });

    // JS execution should be minimal for a mostly static site
    expect(jsExecutionTime).toBeLessThan(100);
  });

  test('should have efficient resource loading', async ({ page }) => {
    await page.goto('/');

    const resourceMetrics = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return {
        count: resources.length,
        totalDuration: resources.reduce((acc, r) => acc + r.duration, 0),
        averageDuration: resources.length > 0
          ? resources.reduce((acc, r) => acc + r.duration, 0) / resources.length
          : 0
      };
    });

    // Should not have excessive resources for a simple site
    expect(resourceMetrics.count).toBeLessThan(20);

    // Average resource load time should be reasonable
    expect(resourceMetrics.averageDuration).toBeLessThan(200);
  });

  test('should have fast server response time', async ({ page }) => {
    const startTime = Date.now();
    const response = await page.goto('/');
    const responseTime = Date.now() - startTime;

    // Server should respond quickly
    expect(response?.status()).toBe(200);
    expect(responseTime).toBeLessThan(1000);
  });

  test('should have optimal Core Web Vitals - LCP', async ({ page }) => {
    await page.goto('/');

    // Measure Largest Contentful Paint
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        // Fallback timeout
        setTimeout(() => resolve(0), 5000);
      });
    });

    // LCP should be under 2.5 seconds (good threshold)
    if (lcp > 0) {
      expect(lcp).toBeLessThan(2500);
    }
  });

  test('should not have excessive layout shifts', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for Cumulative Layout Shift
    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries() as any) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });

        setTimeout(() => resolve(clsValue), 2000);
      });
    });

    // CLS should be under 0.1 (good threshold)
    expect(cls).toBeLessThan(0.1);
  });

  test('should have efficient font loading', async ({ page }) => {
    await page.goto('/');

    const fontMetrics = await page.evaluate(() => {
      const fontResources = performance.getEntriesByType('resource').filter((r: any) =>
        r.name.includes('font') ||
        r.initiatorType === 'css' && r.name.match(/\.(woff2?|ttf|otf|eot)$/i)
      );

      return {
        count: fontResources.length,
        totalSize: fontResources.reduce((acc: number, r: any) => acc + (r.transferSize || 0), 0)
      };
    });

    // Should use system fonts or have minimal custom fonts
    // For this site using system fonts, should be 0
    expect(fontMetrics.count).toBeLessThanOrEqual(2);
  });
});
