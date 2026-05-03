import { expect, test } from '@playwright/test';

test('guided walkthrough happy path: move, edit, save, apply-anyway, and schedule update', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const restartTour = page.getByRole('button', { name: /restart tour/i });
  if (await restartTour.isVisible()) {
    await restartTour.click();
  }

  const banner = page.getByRole('dialog', { name: /guided walkthrough/i });
  await expect(banner).toBeVisible();
  await expect(banner.getByText(/move the mission request/i)).toBeVisible();

  const mission = page.locator('[data-wc-event-id="wt-mission"]').first();
  await expect(mission).toBeVisible();

  // Step 1: drag mission to trigger onEventMove and advance.
  const box = await mission.boundingBox();
  if (!box) throw new Error('Mission not measurable for drag');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2 + 90, { steps: 12 });
  await page.mouse.up();

  await expect(banner.getByText(/assign a pilot/i)).toBeVisible();

  // Step 2: open built-in event form path from Mission Alpha and assign James.
  await mission.click();
  await page.getByRole('button', { name: /^edit$/i }).click();
  await page.getByLabel(/^resource$/i).selectOption('emp-james');
  await page.getByRole('button', { name: /^save$/i }).click();

  await expect(page.getByRole('dialog', { name: /conflicts found/i })).toBeVisible();
  await page.getByRole('button', { name: /apply anyway/i }).click();

  await expect(banner.getByText(/resolve the conflict/i)).toBeVisible();

  // Step 3: reassign to another pilot and save.
  await mission.click();
  await page.getByRole('button', { name: /^edit$/i }).click();
  await page.getByLabel(/^resource$/i).selectOption('emp-priya');
  await page.getByRole('button', { name: /^save$/i }).click();

  await expect(banner.getByText(/see it as a schedule/i)).toBeVisible();

  // Step 4: switch to schedule and verify mission appears on assigned row.
  await page.getByRole('button', { name: /^schedule$/i }).first().click();
  await expect(banner.getByText(/bonus — see where your fleet is/i)).toBeVisible();
  await expect(page.getByText(/mission alpha/i).first()).toBeVisible();

  // Evidence that move and save callbacks fired for walkthrough mission.
  await expect(page.getByText(/Moved: Mission Alpha/i).first()).toBeVisible();
  await expect(page.getByText(/Saved: Mission Alpha/i).first()).toBeVisible();
});
