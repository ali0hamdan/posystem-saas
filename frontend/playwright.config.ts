import { defineConfig, devices } from '@playwright/test';

/*
 * Playwright E2E config for the Nezhin POS frontend.
 *
 * Setup:
 *   cd frontend
 *   npm i -D @playwright/test
 *   npx playwright install
 *
 * Run:
 *   npx playwright test                # headless
 *   npx playwright test --ui           # interactive
 *
 * Credentials for the authenticated flow (set in env or a .env):
 *   E2E_USERNAME, E2E_PASSWORD, E2E_CLIENT_SLUG (optional)
 *
 * The backend API must be running and reachable by the frontend
 * (VITE_API_URL). Playwright will auto-start the Vite dev server.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
