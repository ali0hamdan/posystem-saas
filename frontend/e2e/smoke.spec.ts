import { test, expect } from '@playwright/test';

test.describe('App smoke', () => {
  test('public landing page loads', async ({ page }) => {
    const resp = await page.goto('/');
    expect(resp?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/.+/);
  });

  test('a protected route redirects an unauthenticated user to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/(login|activate)/, { timeout: 10_000 });
  });

  test('no uncaught console errors on the landing page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await page.waitForTimeout(1500);
    expect(errors, errors.join('\n')).toHaveLength(0);
  });
});
