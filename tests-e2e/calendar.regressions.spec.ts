import { test, expect } from '@playwright/test';

// Regression tests for confirmed bugs — add new cases here as issues are filed.
// Use test.fail() for known-open bugs so they stay visible without blocking CI.

test.describe('Calendar regression tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="works-calendar"]', { timeout: 10_000 });
  });

  test('calendar root remains visible after view switch', async ({ page }) => {
    await page.getByRole('button', { name: 'Week' }).click();
    await expect(page.locator('[data-testid="works-calendar"]')).toBeVisible();
    await page.getByRole('button', { name: 'Month' }).click();
    await expect(page.locator('[data-testid="works-calendar"]')).toBeVisible();
  });

  test('no console errors on initial render', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.reload();
    await page.waitForSelector('[data-testid="works-calendar"]');
    expect(errors).toHaveLength(0);
  });
});
