import { test, expect, type BrowserContext } from '@playwright/test';

type EventInvitation = 'nyc' | 'france';

function makeSessionCookiePayload(
  guest: string,
  eventInvitations: EventInvitation[],
  notionId = 'test-notion-id'
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

async function setSessionCookie(
  context: BrowserContext,
  eventInvitations: EventInvitation[]
) {
  const value = makeSessionCookiePayload('Access Test Guest', eventInvitations);
  await context.addCookies([
    {
      name: 'sargaux_auth',
      value,
      url: 'http://localhost:1213',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

test.describe('Event Access Control', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('NYC-only guest is redirected from France URLs to /nyc', async ({ page, context }) => {
    await setSessionCookie(context, ['nyc']);

    await page.goto('/france/details');
    await expect(page).toHaveURL('/nyc');
  });

  test('France-only guest is redirected from NYC URLs to /france', async ({ page, context }) => {
    await setSessionCookie(context, ['france']);

    await page.goto('/nyc/travel');
    await expect(page).toHaveURL('/france');
  });

  test('single-event guest does not see event switcher', async ({ page, context }) => {
    await setSessionCookie(context, ['nyc']);

    await page.goto('/nyc');
    await expect(page.locator('.event-toggle')).toHaveCount(0);
  });

  test('homepage redirects to the guest primary event', async ({ page, context }) => {
    await setSessionCookie(context, ['france']);
    await page.goto('/');
    await expect(page).toHaveURL('/france');
  });

  test('dual-invited guest can access both events and sees switcher', async ({ page, context }) => {
    await setSessionCookie(context, ['nyc', 'france']);

    await page.goto('/nyc');
    await expect(page.locator('.event-toggle')).toBeVisible();

    await page.goto('/france');
    await expect(page).toHaveURL('/france');
    await expect(page.locator('.event-toggle')).toBeVisible();
  });
});
