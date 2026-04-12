import { test, expect } from '@playwright/test';

function dateKey(offsetDays = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

test.describe('WorksCalendar month pill rendering regressions', () => {
  test('cross-day month pill spans the correct day cells without escaping the row', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/regression-bugs.html');

    const pill = page.getByRole('button', { name: /^Cross-Day Hover Range, Incident$/i }).first();
    await expect(pill).toBeVisible();

    const startCell = page.locator(`[data-date="${dateKey(2)}"]`).first();
    const endCell = page.locator(`[data-date="${dateKey(3)}"]`).first();
    await expect(startCell).toBeVisible();
    await expect(endCell).toBeVisible();

    const pillBox = await pill.boundingBox();
    const startBox = await startCell.boundingBox();
    const endBox = await endCell.boundingBox();

    expect(pillBox).not.toBeNull();
    expect(startBox).not.toBeNull();
    expect(endBox).not.toBeNull();

    if (pillBox && startBox && endBox) {
      expect(pillBox.left ?? pillBox.x).toBeGreaterThanOrEqual(startBox.x - 8);
      expect(pillBox.x + pillBox.width).toBeLessThanOrEqual(endBox.x + endBox.width + 8);
      expect(pillBox.width).toBeGreaterThan(startBox.width * 1.5);
      expect(pillBox.height).toBeGreaterThan(10);
    }
  });
});
