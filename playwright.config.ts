import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// The suite runs its own isolated stack (fresh seeded DB, other ports), so it never
// touches the development database and can run while `npm run dev` is up.
const API_PORT = 3101;
const WEB_PORT = 5180;
// Local PGlite database directory (real Postgres in WASM), recreated on every run.
// Only the main process wipes it: workers load this config too, and must not delete
// the files from under the running API server.
const dataDir = path.resolve('e2e/.data/pglite');
if (!process.env.TEST_WORKER_INDEX) {
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
}

// Use the pre-installed Chromium when present (no `playwright install` needed).
const preinstalled = '/opt/pw-browsers/chromium';
const launchOptions =
  !process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(preinstalled) ? { executablePath: preinstalled } : {};

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    timezoneId: 'Europe/Istanbul',
    locale: 'tr-TR',
    viewport: { width: 1400, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } } }],
  webServer: [
    {
      command: 'npm run seed -w server && npm run start -w server',
      url: `http://localhost:${API_PORT}/api/health`,
      // DATABASE_URL is blanked so the suite never touches a real (e.g. Supabase) database.
      env: { PGLITE_DIR: dataDir, DATABASE_URL: '', PORT: String(API_PORT), APP_TIMEZONE: 'Europe/Istanbul' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -w client -- --strictPort',
      url: `http://localhost:${WEB_PORT}`,
      env: { CLIENT_PORT: String(WEB_PORT), API_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
