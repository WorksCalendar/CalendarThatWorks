import { test, expect } from '@playwright/test';

test.describe('WorksCalendar iframe embed', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('host page loads iframe and embedded calendar', async ({ page }) => {
    await page.goto('embed-host.html');

    const frameEl = page.getByTestId('calendar-embed-iframe');
    await expect(frameEl).toBeVisible();
    await expect(frameEl).toHaveAttribute('title', /workscalendar embed demo/i);

    const frame = page.frameLocator('[data-testid="calendar-embed-iframe"]');
    await expect(frame.getByTestId('works-calendar')).toBeVisible();
    await expect(frame.getByRole('toolbar', { name: /calendar navigation/i })).toBeVisible();
  });
});
