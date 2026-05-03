import { expect, test } from '@playwright/test';

test('guided walkthrough end-to-end restores real move/edit/save/conflict/apply-anyway/schedule path', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const banner = page.getByRole('dialog', { name: /guided walkthrough/i });
  await expect(banner).toBeVisible();
  await expect(banner.getByText(/move the mission request/i)).toBeVisible();

  const mission = () => page.locator('[data-wc-event-id="wt-mission"]').first();
  await expect(mission()).toBeVisible();

  const box = await mission().boundingBox();
  if (!box) throw new Error('Mission is not measurable for drag');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2 + 90, { steps: 12 });
  await page.mouse.up();

  await expect(banner.getByText(/assign a pilot/i)).toBeVisible();

  await mission().click();
  await page.getByRole('button', { name: /^edit$/i }).click();
  await page.getByLabel(/^resource$/i).selectOption('emp-james');
  await page.getByRole('button', { name: /^save$/i }).click();

  const conflictPrompt = page
    .getByRole('alertdialog')
    .filter({ hasText: /conflict detected|check before saving/i });
  await expect(conflictPrompt).toBeVisible();
  await conflictPrompt.getByRole('button', { name: /apply anyway/i }).click();

  await expect(banner.getByText(/resolve the conflict/i)).toBeVisible();

  await mission().click();
  await page.getByRole('button', { name: /^edit$/i }).click();
  await page.getByLabel(/^resource$/i).selectOption('emp-priya');
  await page.getByRole('button', { name: /^save$/i }).click();

  await expect(banner.getByText(/see it as a schedule/i)).toBeVisible();

  await page.getByRole('button', { name: /^schedule$/i }).first().click();
  await expect(banner.getByText(/bonus — see where your fleet is/i)).toBeVisible();
  await expect(page.locator('[data-wc-view="schedule"]')).toBeVisible();
  await expect(page.getByText(/mission alpha/i).first()).toBeVisible();

  const eventLog = page.locator('text=/Moved: Walkthrough · Mission Alpha \(request\)|Saved: Walkthrough · Mission Alpha \(request\)/i');
  await expect(eventLog.first()).toBeVisible();
});
