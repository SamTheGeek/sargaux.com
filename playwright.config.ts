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

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:1213',
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
    url: 'http://localhost:1213',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      ...process.env,
      HOST: '0.0.0.0',
      PORT: '1213',
      ASTRO_ADAPTER: 'node',
      FEATURE_GLOBAL_WEDDING_SITE_ENABLED: 'true',
      FEATURE_GLOBAL_NOTION_BACKEND:
        process.env.FEATURE_GLOBAL_NOTION_BACKEND ?? 'true',
      FEATURE_NYC_RSVP_ENABLED: process.env.FEATURE_NYC_RSVP_ENABLED ?? 'true',
      FEATURE_FRANCE_RSVP_ENABLED:
        process.env.FEATURE_FRANCE_RSVP_ENABLED ?? 'true',
    },
  },
});
