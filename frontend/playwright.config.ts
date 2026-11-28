import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against the local Supabase stack (plan §10.2, NFR-TST-02).
 * Prerequisites: `cd backend && supabase start` and `npm run env:local` (CI does both).
 * Locally, PLAYWRIGHT_CHANNEL=chrome runs on the installed Google Chrome instead of
 * Playwright's own Chromium download.
 */
const PORT = 5180;
const channel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) },
    },
  ],
  webServer: {
    // --bypass-lock: Vite 8 refuses a second dev server per project; E2E runs its own on PORT.
    command: `npm run dev -- --port ${String(PORT)} --strictPort --bypass-lock`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
