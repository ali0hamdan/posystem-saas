import { test, expect } from '@playwright/test';

const USERNAME = process.env.E2E_USERNAME;
const PASSWORD = process.env.E2E_PASSWORD;
const CLIENT_SLUG = process.env.E2E_CLIENT_SLUG;

test.describe('Login page', () => {
  test('renders the sign-in form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows validation errors on empty submit', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/username is required/i)).toBeVisible();
    await expect(page.getByText(/password is required/i)).toBeVisible();
  });

  test('shows an error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#username').fill('definitely-not-a-user');
    await page.locator('#password').fill('wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    // The page renders an alert region on a failed login.
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
  });

  test('logs in with valid credentials and lands on the dashboard', async ({ page }) => {
    test.skip(!USERNAME || !PASSWORD, 'Set E2E_USERNAME and E2E_PASSWORD to run the happy path.');
    await page.goto('/login');
    if (CLIENT_SLUG && (await page.locator('#clientSlug').count())) {
      await page.locator('#clientSlug').fill(CLIENT_SLUG);
    }
    await page.locator('#username').fill(USERNAME!);
    await page.locator('#password').fill(PASSWORD!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });
});
