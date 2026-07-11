import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function loadDotEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnvLocal();

// Ensure session signing works for hand-built cookies in unit/e2e helpers
if (!process.env.SESSION_HMAC_SECRET) {
  process.env.SESSION_HMAC_SECRET = 'test-session-hmac-secret-for-playwright';
}
if (!process.env.CALENDAR_HMAC_SECRET) {
  process.env.CALENDAR_HMAC_SECRET = 'test-calendar-hmac-secret-for-playwright';
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Public-repo GitHub-hosted runners have 4 vCPUs. Suites that must not
  // parallelize declare `mode: 'serial'` themselves (rsvp-api, security RSVP
  // hardening); env-mutating unit specs are safe because each worker is its
  // own process. The performance workflow pins --workers=1 on the CLI since
  // its tests assert wall-clock thresholds.
  workers: process.env.CI ? 4 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:1213',
    trace: 'on-first-retry',
  },
  expect: {
    timeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && node ./dist/server/entry.mjs',
    url: 'http://127.0.0.1:1213',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: '1213',
      ASTRO_ADAPTER: 'node',
      ASTRO_CHECK_ORIGIN: 'false',
      RATE_LIMIT_DISABLED: 'true',
      RESEND_ADMIN_SECRET: process.env.RESEND_ADMIN_SECRET ?? 'test-secret-not-set',
      SESSION_HMAC_SECRET:
        process.env.SESSION_HMAC_SECRET ?? 'test-session-hmac-secret-for-playwright',
      CALENDAR_HMAC_SECRET:
        process.env.CALENDAR_HMAC_SECRET ?? 'test-calendar-hmac-secret-for-playwright',
      FEATURE_GLOBAL_WEDDING_SITE_ENABLED: 'true',
      FEATURE_GLOBAL_I18N: process.env.FEATURE_GLOBAL_I18N ?? 'true',
      FEATURE_GLOBAL_NOTION_BACKEND:
        process.env.FEATURE_GLOBAL_NOTION_BACKEND ?? 'true',
      FEATURE_GLOBAL_RSVP_DELETE_ENABLED:
        process.env.FEATURE_GLOBAL_RSVP_DELETE_ENABLED ?? 'true',
      FEATURE_NYC_RSVP_ENABLED: process.env.FEATURE_NYC_RSVP_ENABLED ?? 'true',
      FEATURE_FRANCE_RSVP_ENABLED:
        process.env.FEATURE_FRANCE_RSVP_ENABLED ?? 'true',
      FEATURE_REGISTRY_ENABLED: process.env.FEATURE_REGISTRY_ENABLED ?? 'true',
    },
  },
});
