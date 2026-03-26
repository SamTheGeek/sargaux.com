import { test, expect } from '@playwright/test';

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
    await expect(errorMessage).toContainText('Name not found, it must match exactly.');
    await expect(page).toHaveURL('/');
  });

  test('should login successfully with valid name', async ({ page }) => {
    await page.goto('/');

    await page.click('#login-trigger');
    await page.fill('#name', 'Sam Gross');
    await page.press('#name', 'Enter');

    await expect(page).toHaveURL('/nyc');
    await expect(page.locator('.guest-name')).toContainText('Sam Gross');
  });

  test('should submit login when clicking inline arrow button', async ({ page }) => {
    await page.goto('/');

    await page.click('#login-trigger');
    await page.fill('#name', 'Sam Gross');
    await page.click('#inline-submit');

    await expect(page).toHaveURL('/nyc');
  });

  test('should show loading state while login is in progress', async ({ page }) => {
    let resolveLogin: (() => void) | undefined;
    const loginResponseReady = new Promise<void>((resolve) => {
      resolveLogin = resolve;
    });
    const authCookieValue = Buffer.from(
      JSON.stringify({
        guest: 'Sam Gross',
        eventInvitations: ['nyc'],
        created: Date.now(),
      })
    ).toString('base64url');

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
    await expect(page.locator('.inline-progress-label')).toContainText('Checking...');

    resolveLogin?.();

    await expect(page).toHaveURL('/nyc');
  });

  test('should login with case-insensitive name', async ({ page }) => {
    await page.goto('/');

    await page.click('#login-trigger');
    await page.fill('#name', 'sam gross');
    await page.press('#name', 'Enter');

    await expect(page).toHaveURL('/nyc');
  });

  test('should login with extra whitespace in name', async ({ page }) => {
    await page.goto('/');

    await page.click('#login-trigger');
    await page.fill('#name', '  Sam   Gross  ');
    await page.press('#name', 'Enter');

    await expect(page).toHaveURL('/nyc');
  });

  test('should redirect unauthenticated users from protected routes', async ({ page }) => {
    // Try to access protected route directly
    await page.goto('/nyc');

    // Should redirect to homepage
    await expect(page).toHaveURL('/');
  });

  test('should redirect authenticated users from homepage to /nyc', async ({ page }) => {
    await page.goto('/');
    await page.click('#login-trigger');
    await page.fill('#name', 'Sam Gross');
    await page.press('#name', 'Enter');
    await expect(page).toHaveURL('/nyc');

    await page.goto('/');

    await expect(page).toHaveURL('/nyc');
  });

  test('should logout and redirect to homepage', async ({ page }) => {
    await page.goto('/');
    await page.click('#login-trigger');
    await page.fill('#name', 'Sam Gross');
    await page.press('#name', 'Enter');
    await expect(page).toHaveURL('/nyc');

    await page.click('a[href="/api/logout"]');
    await expect(page).toHaveURL('/');

    await page.click('#login-trigger');
    await expect(page.locator('#inline-entry-control')).toHaveClass(/is-active/);
    await expect(page.locator('#name')).toBeFocused();

    await page.goto('/nyc');
    await expect(page).toHaveURL('/');
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
    const response = await page.evaluate(async () => {
      const formData = new FormData();
      formData.append('name', 'Sam Gross');
      const res = await fetch('/api/login', { method: 'POST', body: formData });
      return { status: res.status, body: await res.json() };
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.guest).toBe('Sam Gross');
    expect(response.body.redirectPath).toBe('/nyc');
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
    await page.fill('#name', 'Sam Gross');
    await page.press('#name', 'Enter');
    await expect(page).toHaveURL('/nyc');

    // Check the cookie exists
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name === 'sargaux_auth');
    expect(authCookie).toBeDefined();
    expect(authCookie!.httpOnly).toBe(true);
    expect(authCookie!.path).toBe('/');
  });

  test('session cookie contains valid base64 JSON payload', async ({ page, context }) => {
    await page.goto('/');
    await page.click('#login-trigger');
    await page.fill('#name', 'Sam Gross');
    await page.press('#name', 'Enter');
    await expect(page).toHaveURL('/nyc');

    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name === 'sargaux_auth');
    expect(authCookie).toBeDefined();

    // Decode and validate the session payload
    const payload = JSON.parse(Buffer.from(authCookie!.value, 'base64url').toString('utf-8'));
    expect(payload.guest).toBe('Sam Gross');
    expect(payload.created).toBeGreaterThan(0);
    // notionId is optional — absent when using hardcoded fallback
    expect(typeof payload.guest).toBe('string');
  });
});
