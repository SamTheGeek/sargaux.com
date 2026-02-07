import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ context }) => {
    // Clear cookies before each test to ensure clean state
    await context.clearCookies();
  });

  test('should show login modal when clicking Enter button', async ({ page }) => {
    await page.goto('/');

    // Click the Enter button
    await page.click('#login-trigger');

    // Modal should be visible
    const modal = page.locator('#login-modal');
    await expect(modal).toHaveAttribute('aria-hidden', 'false');

    // Name input should be visible and focused
    const nameInput = page.locator('#name');
    await expect(nameInput).toBeVisible();
  });

  test('should show error for invalid name', async ({ page }) => {
    await page.goto('/');

    // Open modal
    await page.click('#login-trigger');

    // Enter an invalid name
    await page.fill('#name', 'Invalid Person');
    await page.click('#submit-btn');

    // Should show error message
    const errorMessage = page.locator('#error-message');
    await expect(errorMessage).toContainText("Please enter your name as it appears on your invitation");

    // Should still be on homepage
    await expect(page).toHaveURL('/');
  });

  test('should login successfully with valid name', async ({ page }) => {
    await page.goto('/');

    // Open modal
    await page.click('#login-trigger');

    // Enter valid name
    await page.fill('#name', 'Sam Gross');
    await page.click('#submit-btn');

    // Should redirect to NYC page
    await expect(page).toHaveURL('/nyc');

    // Should show guest name in footer
    await expect(page.locator('.guest-name')).toContainText('Sam Gross');
  });

  test('should login with case-insensitive name', async ({ page }) => {
    await page.goto('/');

    await page.click('#login-trigger');
    await page.fill('#name', 'sam gross');
    await page.click('#submit-btn');

    await expect(page).toHaveURL('/nyc');
  });

  test('should login with extra whitespace in name', async ({ page }) => {
    await page.goto('/');

    await page.click('#login-trigger');
    await page.fill('#name', '  Sam   Gross  ');
    await page.click('#submit-btn');

    await expect(page).toHaveURL('/nyc');
  });

  test('should redirect unauthenticated users from protected routes', async ({ page }) => {
    // Try to access protected route directly
    await page.goto('/nyc');

    // Should redirect to homepage
    await expect(page).toHaveURL('/');
  });

  test('should redirect authenticated users from homepage to /nyc', async ({ page }) => {
    // First login
    await page.goto('/');
    await page.click('#login-trigger');
    await page.fill('#name', 'Sam Gross');
    await page.click('#submit-btn');
    await expect(page).toHaveURL('/nyc');

    // Go back to homepage
    await page.goto('/');

    // Should redirect back to /nyc since already logged in
    await expect(page).toHaveURL('/nyc');
  });

  test('should logout and redirect to homepage', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.click('#login-trigger');
    await page.fill('#name', 'Sam Gross');
    await page.click('#submit-btn');
    await expect(page).toHaveURL('/nyc');

    // Logout
    await page.goto('/api/logout');

    // Should be on homepage
    await expect(page).toHaveURL('/');

    // Try to access protected route
    await page.goto('/nyc');

    // Should redirect to homepage (no longer authenticated)
    await expect(page).toHaveURL('/');
  });

  test('should close modal on Escape key', async ({ page }) => {
    await page.goto('/');

    // Open modal
    await page.click('#login-trigger');
    const modal = page.locator('#login-modal');
    await expect(modal).toHaveAttribute('aria-hidden', 'false');

    // Press Escape
    await page.keyboard.press('Escape');

    // Modal should be hidden
    await expect(modal).toHaveAttribute('aria-hidden', 'true');
  });

  test('should close modal on backdrop click', async ({ page }) => {
    await page.goto('/');

    // Open modal
    await page.click('#login-trigger');
    const modal = page.locator('#login-modal');
    await expect(modal).toHaveAttribute('aria-hidden', 'false');

    // Click backdrop (outside modal content)
    await page.click('#login-modal', { position: { x: 10, y: 10 } });

    // Modal should be hidden
    await expect(modal).toHaveAttribute('aria-hidden', 'true');
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
    expect(response.body.error).toContain('your name as it appears on your invitation');
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
    await page.click('#submit-btn');
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
    await page.click('#submit-btn');
    await expect(page).toHaveURL('/nyc');

    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name === 'sargaux_auth');
    expect(authCookie).toBeDefined();

    // Decode and validate the session payload
    const payload = JSON.parse(Buffer.from(authCookie!.value, 'base64').toString('utf-8'));
    expect(payload.guest).toBe('Sam Gross');
    expect(payload.created).toBeGreaterThan(0);
    // notionId is optional — absent when using hardcoded fallback
    expect(typeof payload.guest).toBe('string');
  });
});
