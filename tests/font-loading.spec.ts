import { test, expect, type BrowserContext } from '@playwright/test';

type EventInvitation = 'nyc' | 'france';

function makeSessionCookiePayload(
  guest: string,
  eventInvitations: EventInvitation[],
  notionId = 'font-loading-test'
): string {
  return Buffer.from(
    JSON.stringify({
      guest,
      notionId,
      eventInvitations,
      created: Date.now(),
    })
  ).toString('base64url');
}

async function setDualEventSession(context: BrowserContext) {
  const value = makeSessionCookiePayload('Font Test Guest', ['nyc', 'france']);
  await context.addCookies([
    {
      name: 'sargaux_auth',
      value,
      url: 'http://127.0.0.1:1213',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

test.describe('Font Loading Regression Guard', () => {
  test('branded custom fonts keep font-display block', async ({ page }) => {
    await page.goto('/');

    const fontDisplays = await page.evaluate(() => {
      const targetFamilies = new Set(['Helvetica Now Display', 'Futura', 'Peignot']);
      const results: Array<{ family: string; display: string; weight: string }> = [];

      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }

        for (const rule of Array.from(rules)) {
          if (!(rule instanceof CSSFontFaceRule)) continue;

          const family = rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
          if (!targetFamilies.has(family)) continue;

          results.push({
            family,
            display: rule.style.getPropertyValue('font-display').trim(),
            weight: rule.style.getPropertyValue('font-weight').trim(),
          });
        }
      }

      return results;
    });

    expect(fontDisplays.length).toBeGreaterThan(0);
    for (const fontFace of fontDisplays) {
      expect(fontFace.display, `${fontFace.family} ${fontFace.weight}`).toBe('block');
    }
  });

  test('NYC display font faces stay block-loaded on the NYC route', async ({ page, context }) => {
    await setDualEventSession(context);
    await page.goto('/nyc');

    const nycFontDisplays = await page.evaluate(() => {
      const results: Array<{ weight: string; display: string }> = [];

      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }

        for (const rule of Array.from(rules)) {
          if (!(rule instanceof CSSFontFaceRule)) continue;

          const family = rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
          if (family !== 'Helvetica Now Display') continue;

          results.push({
            weight: rule.style.getPropertyValue('font-weight').trim(),
            display: rule.style.getPropertyValue('font-display').trim(),
          });
        }
      }

      return results;
    });

    expect(nycFontDisplays).toEqual(
      expect.arrayContaining([
        { weight: '400', display: 'block' },
        { weight: '500', display: 'block' },
        { weight: '700', display: 'block' },
      ])
    );
  });

  test('France route keeps preloading the above-the-fold custom font files', async ({ page, context }) => {
    await setDualEventSession(context);
    await page.goto('/france');

    const preloadHrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('link[rel="preload"][as="font"]'))
        .map((link) => link.getAttribute('href') ?? '')
        .filter(Boolean)
    );

    expect(preloadHrefs).toEqual(
      expect.arrayContaining([
        '/fonts/Peignot 400.ttf',
        '/fonts/peignot-bold.otf',
        '/fonts/futura/FuturaPTBook.otf',
        '/fonts/futura/FuturaPTMedium.otf',
        '/fonts/futura/FuturaPTDemi.otf',
      ])
    );
  });

  for (const path of ['/nyc', '/couple']) {
    test(`${path} keeps preloading the Helvetica display face used above the fold`, async ({ page, context }) => {
      await setDualEventSession(context);
      await page.goto(path);

      const preloadHrefs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('link[rel="preload"][as="font"]'))
          .map((link) => link.getAttribute('href') ?? '')
          .filter(Boolean)
      );

      expect(preloadHrefs).toContain('/fonts/helvetica-now/HelveticaNowDisplay-Medium.ttf');
    });
  }
});
