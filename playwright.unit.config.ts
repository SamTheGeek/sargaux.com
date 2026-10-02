import { defineConfig } from '@playwright/test';
import { UNIT_SPECS } from './tests/unit-specs';

// Ensure session signing works for the hand-built tokens in the unit specs.
process.env.SESSION_HMAC_SECRET ??= 'test-session-hmac-secret-for-playwright';
process.env.CALENDAR_HMAC_SECRET ??= 'test-calendar-hmac-secret-for-playwright';

/**
 * Unit-only run: no webServer (so no build), no browser, no Notion secrets.
 * See tests/unit-specs.ts for what qualifies.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: UNIT_SPECS,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
});
