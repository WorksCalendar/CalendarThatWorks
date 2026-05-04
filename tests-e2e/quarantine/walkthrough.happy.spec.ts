import { expect, test } from '@playwright/test';

/**
 * Quarantined walkthrough happy-path E2E.
 *
 * Why quarantined/release-only:
 * - Exercises an end-to-end guided-tour + drag + conflict workflow that is
 *   valuable coverage but historically flaky as a per-PR gate.
 * - Intended for manual/nightly/release runs until stability is proven.
 */
test.describe('quarantine: walkthrough full happy path', () => {
  test('guided demo can complete end-to-end with conflict handling and schedule verification', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
      } catch {
        // Ignore storage failures in restricted environments.
      }
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.getByTestId('works-calendar')).toBeVisible();

    const banner = page.getByRole('dialog', { name: /guided walkthrough/i });
    await expect(banner).toBeVisible();

    // Start/restart guided mode if controls are available.
    const startTour = page.getByRole('button', { name: /start tour|restart tour|start walkthrough|restart walkthrough/i }).first();
    if (await startTour.isVisible().catch(() => false)) {
      await startTour.click();
      await expect(banner).toBeVisible();
    }

    const mission = page.locator('[data-wc-event-id="wt-mission"]').first();
    await expect(mission).toBeVisible();
    await mission.scrollIntoViewIfNeeded();

    // Move Mission Alpha via real UI drag-and-drop, then verify visible result.
    const before = await mission.boundingBox();
    if (!before) throw new Error('Mission Alpha is not measurable before drag');

    const startX = before.x + before.width / 2;
    const startY = before.y + before.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 260, startY, { steps: 12 });
    await page.mouse.up();

    await expect
      .poll(async () => {
        const after = await mission.boundingBox();
        if (!after) return false;
        const movedX = Math.abs(after.x - before.x);
        const movedY = Math.abs(after.y - before.y);
        return movedX > 10 || movedY > 10;
      })
      .toBe(true);

    await expect(banner).toContainText(/assign|edit|pilot|next/i);

    await mission.click();
    await page.getByRole('button', { name: /edit event/i }).click();

    const editDialog = page.getByRole('dialog', { name: /edit event/i });
    await expect(editDialog).toBeVisible();

    const resourceField = editDialog.locator('#ef-resource');
    await expect(resourceField).toBeVisible();
    await resourceField.fill('emp-james');
    await editDialog.getByRole('button', { name: /save changes/i }).click();

    const conflictDialog = page.getByRole('dialog').filter({ hasText: /conflict|overlap|double-book/i }).first();
    await expect(conflictDialog).toBeVisible();

    await conflictDialog.getByRole('button', { name: /proceed anyway/i }).click();

    await mission.click();
    await page.getByRole('button', { name: /edit event/i }).click();

    const reassignDialog = page.getByRole('dialog', { name: /edit event/i });
    await expect(reassignDialog).toBeVisible();

    const reassignResourceField = reassignDialog.locator('#ef-resource');
    await expect(reassignResourceField).toBeVisible();
    await reassignResourceField.fill('emp-rivera');
    await reassignDialog.getByRole('button', { name: /save changes/i }).click();

    await page.getByRole('button', { name: /^schedule$/i }).first().click();
    await expect(page.locator('[data-wc-event-id="wt-mission"]').first()).toBeVisible();
  });
});
