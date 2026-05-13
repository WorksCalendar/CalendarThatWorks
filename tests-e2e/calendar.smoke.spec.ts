import { test, expect } from '@playwright/test';

test.describe('Calendar smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForSelector('[data-testid="works-calendar"]', { timeout: 10_000 });
    expect(errors, 'No runtime errors on load').toHaveLength(0);
  });

  test('calendar renders without crashing', async ({ page }) => {
    await expect(page.locator('[data-testid="works-calendar"]')).toBeVisible();
  });

  test('navigation toolbar is present', async ({ page }) => {
    await expect(page.getByRole('toolbar', { name: 'Calendar navigation' })).toBeVisible();
  });

  test('can switch between Month, Week, Day, and Agenda views', async ({ page }) => {
    const viewGroup = page.getByRole('group', { name: 'Calendar view' });
    for (const view of ['Week', 'Day', 'Agenda', 'Month']) {
      await viewGroup.getByRole('button', { name: view }).click();
      await expect(page.locator('[data-testid="works-calendar"]')).toBeVisible();
    }
  });

  test('can open the add-event dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'Add new event' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
