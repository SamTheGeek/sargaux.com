import { test, expect, type Page } from '@playwright/test';

/**
 * Every metric below describes the same page load of `/`, so the page is
 * loaded once and measured once; each test then asserts one threshold. Loading
 * `/` per test (as this file used to) made ten navigations for one data set,
 * and the CLS test alone idled for 2s on a fixed timer.
 *
 * Serial because the tests share the measured page — and because CI pins
 * --workers=1 for this file anyway (wall-clock thresholds).
 */
test.describe.configure({ mode: 'serial' });

interface HomepageMetrics {
  status: number | undefined;
  responseTime: number;
  fcp: number;
  lcp: number;
  cls: number;
  domContentLoaded: number;
  loadTime: number;
  totalTransferSize: number;
  resourceCount: number;
  averageResourceDuration: number;
  fontResourceCount: number;
}

async function measureHomepage(page: Page): Promise<HomepageMetrics> {
  const startTime = Date.now();
  const response = await page.goto('/');
  const responseTime = Date.now() - startTime;
  await page.waitForLoadState('networkidle');

  // Paint/LCP/layout-shift entries are buffered, so observing after the fact
  // still delivers them; the double rAF lets the observer callback fire.
  const observed = await page.evaluate(
    () =>
      new Promise<{ fcp: number; lcp: number; cls: number }>((resolve) => {
        const result = { fcp: 0, lcp: 0, cls: 0 };
        const observe = (type: string, onEntry: (entry: any) => void) => {
          new PerformanceObserver((list) => list.getEntries().forEach(onEntry)).observe({
            type,
            buffered: true,
          });
        };
        observe('paint', (e) => {
          if (e.name === 'first-contentful-paint') result.fcp = e.startTime;
        });
        observe('largest-contentful-paint', (e) => {
          result.lcp = e.startTime; // last entry wins
        });
        observe('layout-shift', (e) => {
          if (!e.hadRecentInput) result.cls += e.value;
        });
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(result)));
      })
  );

  const timing = await page.evaluate(() => {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const totalDuration = resources.reduce((acc, r) => acc + r.duration, 0);
    return {
      domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.startTime : 0,
      loadTime: nav ? nav.loadEventEnd - nav.startTime : 0,
      totalTransferSize: resources.reduce((acc, r) => acc + (r.transferSize || 0), 0),
      resourceCount: resources.length,
      averageResourceDuration: resources.length > 0 ? totalDuration / resources.length : 0,
      fontResourceCount: resources.filter(
        (r) => r.name.includes('font') || /\.(woff2?|ttf|otf|eot)$/i.test(r.name)
      ).length,
    };
  });

  return { status: response?.status(), responseTime, ...observed, ...timing };
}

test.describe('Performance Tests', () => {
  let metrics: HomepageMetrics;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    metrics = await measureHomepage(page);
    await context.close();
  });

  test('should have fast server response time', () => {
    expect(metrics.status).toBe(200);
    expect(metrics.responseTime).toBeLessThan(1000);
  });

  test('should have fast First Contentful Paint (FCP)', () => {
    expect(metrics.fcp).toBeGreaterThan(0);
    expect(metrics.fcp).toBeLessThan(1800); // "good" threshold
  });

  test('should have optimal Core Web Vitals - LCP', () => {
    // Chromium may not report an LCP entry for every page; 0 means none seen.
    if (metrics.lcp > 0) expect(metrics.lcp).toBeLessThan(2500);
  });

  test('should not have excessive layout shifts', () => {
    expect(metrics.cls).toBeLessThan(0.1);
  });

  test('should have fast DOM Content Loaded and load time (TTI proxy)', () => {
    expect(metrics.domContentLoaded).toBeLessThan(1500);
    expect(metrics.loadTime).toBeLessThan(3800);
  });

  test('should have small total page size', () => {
    expect(metrics.totalTransferSize).toBeLessThan(500000);
  });

  test('should have efficient resource loading', () => {
    expect(metrics.resourceCount).toBeLessThan(20);
    expect(metrics.averageResourceDuration).toBeLessThan(200);
  });

  test('should have efficient font loading', () => {
    expect(metrics.fontResourceCount).toBeLessThanOrEqual(2);
  });
});
