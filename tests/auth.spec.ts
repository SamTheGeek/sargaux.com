import { test, expect, type Page } from '@playwright/test';
import { createSessionToken } from '../src/lib/auth';
import { TEST_GUEST_NAME, TEST_GUEST_FRANCE_NAME, TEST_GUEST_PARTNER_NAME } from './fixtures';

// Name variants for normalization tests, derived from the synthetic test
// guest so no real guest record is exercised by the suite.
const TEST_GUEST_LOWERCASE = TEST_GUEST_NAME.toLowerCase();
const TEST_GUEST_WHITESPACE = `  ${TEST_GUEST_NAME.split(' ').join('   ')}  `;

test.describe('Authentication', () => {
  test.beforeEach(async ({ context }) => {
    // Clear cookies before each test to ensure clean state
    await context.clearCookies();
  });

  test('should reveal and focus inline name input when clicking Enter button', async ({ page }) => {
    await page.goto('/');

    await page.click('#login-trigger');

    const nameInput = page.locator('#name');
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toBeFocused();
  });

  test('should switch homepage language to French from the footer switcher', async ({ page }) => {
    await page.goto('/');
    await page.locator('.hero-disc').evaluate((element) => {
      element.setAttribute('data-persist-probe', 'home-disc');
    });

    await page.getByLabel('Passer en français').click();

    await expect(page).toHaveURL(/lang=fr/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('.panel-intro')).toContainText('Veuillez entrer votre nom');
    await expect(page.locator('.hero-disc')).toHaveAttribute('data-persist-probe', 'home-disc');
  });

  test('should collapse inline name input when clicking outside with no text entered', async ({ page }) => {
    await page.goto('/');

    await page.click('#login-trigger');
    await expect(page.locator('#inline-entry-control')).toHaveClass(/is-active/);

    await page.locator('body').click({ position: { x: 20, y: 20 } });

    await expect(page.locator('#inline-entry-control')).not.toHaveClass(/is-active/);
    await expect(page.locator('#login-trigger')).toBeVisible();
  });

  test('should show error for invalid name', async ({ page }) => {
    await page.goto('/');

    await page.click('#login-trigger');

    await page.fill('#name', 'Invalid Person');
    await page.press('#name', 'Enter');

    const errorMessage = page.locator('#error-message');
    await expect(errorMessage).toContainText(
      'Please enter the first and last name of one member of your party.'
    );
    await expect(errorMessage).toContainText(
      "If you're responding for you and a guest (or your family), you'll be able to RSVP for your entire group."
    );
    await expect(page).toHaveURL('/');
  });

  test('should login successfully with valid name', async ({ page }) => {
    await page.goto('/');

    await page.click('#login-trigger');
    await page.fill('#name', TEST_GUEST_NAME);
    await page.press('#name', 'Enter');

    await expect(page).toHaveURL('/nyc');
    await expect(page.locator('.guest-name')).toContainText(TEST_GUEST_NAME);
  });

  test('should submit login when clicking inline arrow button', async ({ page }) => {
    await page.goto('/');

    await page.click('#login-trigger');
    await page.fill('#name', TEST_GUEST_NAME);
    await page.click('#inline-submit');

    await expect(page).toHaveURL('/nyc');
  });

  test('should show loading state while login is in progress', async ({ page }) => {
    let resolveLogin: (() => void) | undefined;
    const loginResponseReady = new Promise<void>((resolve) => {
      resolveLogin = resolve;
    });
    const authCookieValue = createSessionToken('Sam Gross', undefined, ['nyc']);

    await page.route('**/api/login', async (route) => {
      await loginResponseReady;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Set-Cookie': `sargaux_auth=${authCookieValue}; Path=/; HttpOnly; SameSite=Lax`,
        },
        body: JSON.stringify({ success: true, guest: 'Sam Gross', redirectPath: '/nyc' }),
      });
    });

    await page.goto('/');
    await page.click('#login-trigger');
    await page.fill('#name', 'Sam Gross');
    await page.press('#name', 'Enter');

    await expect(page.locator('#inline-entry-control')).toHaveClass(/is-loading/);
    await expect(page.locator('#inline-submit')).toBeDisabled();
    await expect(page.locator('#name')).toBeDisabled();
    await expect(page.locator('.inline-progress-label')).toContainText('Checking');

    resolveLogin?.();

    await expect(page).toHaveURL('/nyc');
  });

  test('should login with case-insensitive name', async ({ page }) => {
    await page.goto('/');

    await page.click('#login-trigger');
    await page.fill('#name', TEST_GUEST_LOWERCASE);
    await page.press('#name', 'Enter');

    await expect(page).toHaveURL('/nyc');
  });

  test('should login with extra whitespace in name', async ({ page }) => {
    await page.goto('/');

    await page.click('#login-trigger');
    await page.fill('#name', TEST_GUEST_WHITESPACE);
    await page.press('#name', 'Enter');

    await expect(page).toHaveURL('/nyc');
  });

  test('should redirect unauthenticated users from protected routes', async ({ page }) => {
    // Try to access protected route directly
    await page.goto('/nyc');

    // Should redirect to homepage, carrying the requested page so login can
    // return the guest to it (see src/lib/return-to.ts).
    await expect(page).toHaveURL('/?next=%2Fnyc');
  });

  test('should redirect authenticated users from homepage to /nyc', async ({ page }) => {
    await page.goto('/');
    await page.click('#login-trigger');
    await page.fill('#name', TEST_GUEST_NAME);
    await page.press('#name', 'Enter');
    await expect(page).toHaveURL('/nyc');

    await page.goto('/');

    await expect(page).toHaveURL('/nyc');
  });

  test('should logout and redirect to homepage', async ({ page }) => {
    await page.goto('/');
    await page.click('#login-trigger');
    await page.fill('#name', TEST_GUEST_NAME);
    await page.press('#name', 'Enter');
    await expect(page).toHaveURL('/nyc');

    await page.click('a[href="/api/logout"]');
    await expect(page).toHaveURL('/');

    await page.click('#login-trigger');
    await expect(page.locator('#inline-entry-control')).toHaveClass(/is-active/);
    await expect(page.locator('#name')).toBeFocused();

    await page.goto('/nyc');
    await expect(page).toHaveURL('/?next=%2Fnyc');
  });

  test('should have a visible back link on RSVP pages', async ({ page }) => {
    await page.goto('/');
    await page.click('#login-trigger');
    await page.fill('#name', TEST_GUEST_NAME);
    await page.press('#name', 'Enter');
    await expect(page).toHaveURL('/nyc');

    for (const route of ['/nyc/rsvp', '/france/rsvp']) {
      await page.goto(route);
      await expect(page.locator('.back-link').first()).toBeVisible();
    }
  });

  test('should keep inline name input open when it contains text', async ({ page }) => {
    await page.goto('/');

    await page.click('#login-trigger');
    await page.fill('#name', 'Sam');
    await page.locator('body').click({ position: { x: 20, y: 20 } });

    await expect(page.locator('#inline-entry-control')).toHaveClass(/is-active/);
    await expect(page.locator('#name')).toHaveValue('Sam');
  });

  test('login API returns JSON with success and guest name', async ({ page }) => {
    await page.goto('/');

    // Call the login API directly
    const response = await page.evaluate(async (guestName) => {
      const formData = new FormData();
      formData.append('name', guestName);
      const res = await fetch('/api/login', { method: 'POST', body: formData });
      return { status: res.status, body: await res.json() };
    }, TEST_GUEST_NAME);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.guest).toBe(TEST_GUEST_NAME);
    expect(response.body.redirectPath).toBe('/nyc');
  });

  test('login defaults France-based guests to the French locale', async ({ page, context }) => {
    // Start from a clean cookie jar — clearing only sargaux_lang after a
    // homepage visit can leave a race with the footer/lang middleware.
    // TEST_GUEST_FRANCE_NAME is the synthetic Country=FRANCE guest; the default
    // TEST_GUEST_NAME is Country=USA and would take the English branch.
    await context.clearCookies();
    await page.goto('/');

    const response = await page.evaluate(async (guestName) => {
      const formData = new FormData();
      formData.append('name', guestName);
      const res = await fetch('/api/login', { method: 'POST', body: formData });
      return { status: res.status, body: await res.json() };
    }, TEST_GUEST_FRANCE_NAME);
    expect(response.status).toBe(200);

    const cookies = await context.cookies();
    const langCookie = cookies.find((c) => c.name === 'sargaux_lang');
    expect(langCookie?.value).toBe('fr');
  });

  test('login defaults non-French guests to the English locale', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');

    const response = await page.evaluate(async (guestName) => {
      const formData = new FormData();
      formData.append('name', guestName);
      const res = await fetch('/api/login', { method: 'POST', body: formData });
      return { status: res.status, body: await res.json() };
    }, TEST_GUEST_NAME);
    expect(response.status).toBe(200);

    const cookies = await context.cookies();
    const langCookie = cookies.find((c) => c.name === 'sargaux_lang');
    expect(langCookie?.value).toBe('en');
  });

  test('login does not override an existing language preference', async ({ page, context }) => {
    await page.goto('/?lang=fr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

    const response = await page.evaluate(async (guestName) => {
      const formData = new FormData();
      formData.append('name', guestName);
      const res = await fetch('/api/login', { method: 'POST', body: formData });
      return { status: res.status, body: await res.json() };
    }, TEST_GUEST_NAME);
    expect(response.status).toBe(200);

    const cookies = await context.cookies();
    const langCookie = cookies.find((c) => c.name === 'sargaux_lang');
    expect(langCookie?.value).toBe('fr');
  });

  test('login API returns 401 for unknown guest', async ({ page }) => {
    await page.goto('/');

    const response = await page.evaluate(async () => {
      const formData = new FormData();
      formData.append('name', 'Not A Real Guest');
      const res = await fetch('/api/login', { method: 'POST', body: formData });
      return { status: res.status, body: await res.json() };
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Name not found, it must match exactly.');
  });

  test('login API returns 400 for empty name', async ({ page }) => {
    await page.goto('/');

    const response = await page.evaluate(async () => {
      const formData = new FormData();
      formData.append('name', '');
      const res = await fetch('/api/login', { method: 'POST', body: formData });
      return { status: res.status, body: await res.json() };
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('enter your name');
  });

  test('session cookie is set as httpOnly after login', async ({ page, context }) => {
    await page.goto('/');
    await page.click('#login-trigger');
    await page.fill('#name', TEST_GUEST_NAME);
    await page.press('#name', 'Enter');
    await expect(page).toHaveURL('/nyc');

    // Check the cookie exists
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name === 'sargaux_auth');
    expect(authCookie).toBeDefined();
    expect(authCookie!.httpOnly).toBe(true);
    expect(authCookie!.path).toBe('/');
  });

  test('session cookie contains signed payload.hmac token', async ({ page, context }) => {
    await page.goto('/');
    await page.click('#login-trigger');
    await page.fill('#name', TEST_GUEST_NAME);
    await page.press('#name', 'Enter');
    await expect(page).toHaveURL('/nyc');

    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name === 'sargaux_auth');
    expect(authCookie).toBeDefined();

    // Format: base64url(payload).hmac
    const [payloadB64, hmac] = authCookie!.value.split('.');
    expect(payloadB64).toBeTruthy();
    expect(hmac).toMatch(/^[0-9a-f]{32}$/);

    const payload = JSON.parse(Buffer.from(payloadB64!, 'base64url').toString('utf-8'));
    expect(payload.guest).toBe(TEST_GUEST_NAME);
    expect(payload.created).toBeGreaterThan(0);
    expect(typeof payload.guest).toBe('string');
  });
});

/**
 * Envelope-name login: a guest types the name printed on their invitation
 * envelope, which addresses a household rather than one person, and picks who
 * they are before a session is minted.
 *
 * Exercised against the synthetic party (Alex Rivera + Jordan Chen), which
 * exists both in Notion and in the hardcoded fallback list, so these run in
 * either backend mode.
 */
test.describe('Envelope-name login', () => {
  const PARTNER_NAME = TEST_GUEST_PARTNER_NAME;
  const ENVELOPE_NAME = `${TEST_GUEST_NAME} & ${PARTNER_NAME}`;

  /** POST /api/login from the page context and return status + parsed body. */
  const postLogin = (page: Page, fields: Record<string, string>) =>
    page.evaluate(async (entries) => {
      const formData = new FormData();
      for (const [key, value] of Object.entries(entries)) formData.append(key, value);
      const res = await fetch('/api/login', { method: 'POST', body: formData });
      return { status: res.status, body: await res.json() };
    }, fields);

  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto('/');
  });

  test('an envelope name asks who you are instead of logging you in', async ({ page, context }) => {
    const response = await postLogin(page, { name: ENVELOPE_NAME });

    expect(response.status).toBe(200);
    expect(response.body.needsIdentity).toBe(true);
    expect(response.body.claim).toBeTruthy();

    const names = response.body.candidates.map((c: { name: string }) => c.name).sort();
    expect(names).toEqual([TEST_GUEST_NAME, PARTNER_NAME].sort());

    // Critically: no session yet. The claim is the only thing carried forward.
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'sargaux_auth')).toBeUndefined();
  });

  test('reordered first names reach the same household', async ({ page }) => {
    const response = await postLogin(page, { name: `${PARTNER_NAME} and ${TEST_GUEST_NAME}` });
    expect(response.status).toBe(200);
    expect(response.body.needsIdentity).toBe(true);
  });

  test('redeeming a claim signs in the guest who was picked', async ({ page, context }) => {
    const first = await postLogin(page, { name: ENVELOPE_NAME });
    const partner = first.body.candidates.find(
      (c: { name: string }) => c.name === PARTNER_NAME
    );

    const second = await postLogin(page, { claim: first.body.claim, guestId: partner.id });
    expect(second.status).toBe(200);
    expect(second.body.guest).toBe(PARTNER_NAME);

    const cookies = await context.cookies();
    const authCookie = cookies.find((c) => c.name === 'sargaux_auth');
    expect(authCookie).toBeDefined();

    const [payloadB64] = authCookie!.value.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64!, 'base64url').toString('utf-8'));
    expect(payload.guest).toBe(PARTNER_NAME);
  });

  test('a claim cannot be redeemed for someone outside its household', async ({
    page,
    context,
  }) => {
    const first = await postLogin(page, { name: ENVELOPE_NAME });

    const response = await postLogin(page, {
      claim: first.body.claim,
      guestId: 'fallback:casey-morgan',
    });

    expect(response.status).toBe(401);
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'sargaux_auth')).toBeUndefined();
  });

  test('a tampered claim is rejected', async ({ page, context }) => {
    const first = await postLogin(page, { name: ENVELOPE_NAME });
    const [payloadB64] = first.body.claim.split('.');
    const candidate = first.body.candidates[0];

    const response = await postLogin(page, {
      claim: `${payloadB64}.00000000000000000000000000000000`,
      guestId: candidate.id,
    });

    expect(response.status).toBe(401);
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'sargaux_auth')).toBeUndefined();
  });

  test('an unknown name is still rejected with the usual message', async ({ page }) => {
    const response = await postLogin(page, { name: 'Nobody Whatsoever' });
    expect(response.status).toBe(401);
    expect(response.body.error).toContain('must match exactly');
    expect(response.body.needsIdentity).toBeUndefined();
  });

  test('a bare surname does not unlock a household', async ({ page }) => {
    const response = await postLogin(page, { name: 'Rivera' });
    expect(response.status).toBe(401);
  });

  test('picking a name in the inline picker completes the login', async ({ page }) => {
    await page.click('#login-trigger');
    await page.fill('#name', ENVELOPE_NAME);
    await page.press('#name', 'Enter');

    const picker = page.locator('#identity-picker');
    await expect(picker).toBeVisible();
    await expect(picker.locator('.identity-option')).toHaveCount(2);

    await picker.getByRole('button', { name: PARTNER_NAME }).click();
    await expect(page).toHaveURL('/nyc');
  });

  test('"none of these" restores the name field', async ({ page }) => {
    await page.click('#login-trigger');
    await page.fill('#name', ENVELOPE_NAME);
    await page.press('#name', 'Enter');

    await expect(page.locator('#identity-picker')).toBeVisible();
    await page.click('#identity-back');

    await expect(page.locator('#identity-picker')).toBeHidden();
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#name')).toHaveValue('');
  });

  test('the picker stays out of the focus order until it is needed', async ({ page }) => {
    // The collapsed picker must not be tabbable — same contract the hidden
    // name input relies on.
    const focusable = await page
      .locator('#identity-picker button')
      .evaluateAll((nodes) => nodes.filter((node) => (node as HTMLElement).offsetParent !== null).length);
    expect(focusable).toBe(0);
  });
});

test.describe('Deep-link return after login', () => {
  const PARTNER_NAME = TEST_GUEST_PARTNER_NAME;
  const ENVELOPE_NAME = `${TEST_GUEST_NAME} & ${PARTNER_NAME}`;

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('the login page varies its CDN cache on next', async ({ page }) => {
    // The language switcher server-renders ?next= into its hrefs, so a shared
    // cache variant would pin one guest's destination into everyone's links.
    const response = await page.goto('/?next=%2Ffrance%2Flookbook');
    expect(response?.headers()['netlify-vary']).toContain('next');
  });

  test('a protected deep link is carried to the login page', async ({ page }) => {
    await page.goto('/france/lookbook');
    await expect(page).toHaveURL('/?next=%2Ffrance%2Flookbook');
    // The login bar is the landing state, not the event page.
    await expect(page.locator('#login-trigger')).toBeVisible();
  });

  /*
    The tests below that type a real name need the Notion backend. This one
    does not: it mocks /api/login and asserts the *client* half of the contract
    — that the homepage script lifts `next` out of location.search and posts it
    — so the wiring stays covered even where guest credentials aren't
    configured. The server half is covered by tests/return-to-unit.spec.ts.
  */
  test('the login POST carries the next param from the URL', async ({ page }) => {
    let postedNext: string | null = null;

    // The form posts multipart/form-data, so pull the field out of the raw body.
    const readField = (body: string, field: string) =>
      body.match(new RegExp(`name="${field}"\\r?\\n\\r?\\n([^\\r\\n]*)`))?.[1] ?? null;

    await page.route('**/api/login', async (route) => {
      postedNext = readField(route.request().postData() ?? '', 'next');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          guest: TEST_GUEST_NAME,
          redirectPath: '/france/lookbook',
        }),
      });
    });

    await page.goto('/france/lookbook');
    await expect(page).toHaveURL('/?next=%2Ffrance%2Flookbook');

    await page.click('#login-trigger');
    await page.fill('#name', TEST_GUEST_NAME);

    // The mocked response sets no session cookie, so middleware bounces the
    // destination straight back to the login page. Watch for the navigation
    // request itself rather than the final URL — what's under test here is
    // that the client asked for the deep link, not that the session took.
    const navigation = page.waitForRequest(
      (request) => new URL(request.url()).pathname === '/france/lookbook'
    );
    await page.press('#name', 'Enter');
    await navigation;

    expect(postedNext).toBe('/france/lookbook');
  });

  test('logging in returns the guest to the page they asked for', async ({ page }) => {
    await page.goto('/france/lookbook');
    await page.click('#login-trigger');
    await page.fill('#name', TEST_GUEST_NAME);
    await page.press('#name', 'Enter');

    await expect(page).toHaveURL('/france/lookbook');
    // The disc-as-O must be present on arrival — this is the shared
    // `event-disc` element the transition FLIPs into.
    await expect(page.locator('.lookbook-disc-slot .lookbook-disc')).toBeAttached();
  });

  test('a deep link survives the two-step identity picker', async ({ page }) => {
    await page.goto('/nyc/travel');
    await expect(page).toHaveURL('/?next=%2Fnyc%2Ftravel');

    await page.click('#login-trigger');
    await page.fill('#name', ENVELOPE_NAME);
    await page.press('#name', 'Enter');

    const picker = page.locator('#identity-picker');
    await expect(picker).toBeVisible();
    await picker.getByRole('button', { name: PARTNER_NAME }).click();

    await expect(page).toHaveURL('/nyc/travel');
  });

  test('a query string on the deep link is preserved', async ({ page }) => {
    await page.goto('/france/schedule?lang=fr');
    await expect(page).toHaveURL('/?next=%2Ffrance%2Fschedule%3Flang%3Dfr');

    await page.click('#login-trigger');
    await page.fill('#name', TEST_GUEST_NAME);
    await page.press('#name', 'Enter');

    await expect(page).toHaveURL('/france/schedule?lang=fr');
  });

  test('an off-site next is refused and falls back to the default route', async ({ page }) => {
    await page.goto('/?next=https%3A%2F%2Fevil.example');
    await page.click('#login-trigger');
    await page.fill('#name', TEST_GUEST_NAME);
    await page.press('#name', 'Enter');

    await expect(page).toHaveURL('/nyc');
  });

  test('an already-authenticated guest hitting /?next= is forwarded too', async ({ page }) => {
    await page.goto('/');
    await page.click('#login-trigger');
    await page.fill('#name', TEST_GUEST_NAME);
    await page.press('#name', 'Enter');
    await expect(page).toHaveURL('/nyc');

    await page.goto('/?next=%2Ffrance%2Flookbook');
    await expect(page).toHaveURL('/france/lookbook');
  });
});
