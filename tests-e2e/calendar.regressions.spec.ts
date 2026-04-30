import { test, expect } from '@playwright/test';

function fixtureBaseDate() {
  const d = new Date();
  d.setDate(10);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(offsetDays = 0) {
  const d = fixtureBaseDate();
  d.setDate(d.getDate() + offsetDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Same env-noise filter as calendar.demo.spec.ts — sandboxed runners surface
// chromium cert errors that aren't part of the calendar's contract. We do
// NOT filter blanket 4xx/5xx here, since those can fire for real same-origin
// regressions (a broken local asset, a 500 from the demo's own data path);
// see the long comment in calendar.demo.spec.ts for the rationale.
const ENV_NOISE_PATTERNS = [
  /net::ERR_CERT_AUTHORITY_INVALID/i,
  /net::ERR_CERT_DATE_INVALID/i,
  /net::ERR_CERT_COMMON_NAME_INVALID/i,
];

function ignoreEnvNoise(line) {
  return !ENV_NOISE_PATTERNS.some((re) => re.test(line));
}

test.describe('WorksCalendar targeted regressions', () => {
  test('dragging a month pill does not crash the page', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/regression-bugs.html');

    const pill = page.getByRole('button', { name: /Drag Crash Pill/i }).first();
    await expect(pill).toBeVisible();

    const sourceBox = await pill.boundingBox();
    const target = page.locator(`[data-date="${dateKey(1)}"]`).first();
    await expect(target).toBeVisible();
    const targetBox = await target.boundingBox();

    expect(sourceBox).not.toBeNull();
    expect(targetBox).not.toBeNull();

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
    await page.mouse.up();

    await expect(page.getByTestId('works-calendar')).toBeVisible();
    expect(pageErrors.filter(ignoreEnvNoise)).toEqual([]);
    expect(consoleErrors.filter(ignoreEnvNoise)).toEqual([]);
  });

  test('hover card shows the full cross-day range for a timed multi-day event', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/regression-bugs.html');

    // Use partial match so the selector works even when the event splits
    // across week rows (aria-label gains ", continues next week" suffix).
    const crossDay = page.getByRole('button', { name: /Cross-Day Hover Range, Incident/i }).first();
    await expect(crossDay).toBeVisible();
    await crossDay.evaluate((el) => el.click());

    const dialog = page.getByRole('dialog', { name: /Event details: Cross-Day Hover Range/i });
    await expect(dialog).toBeVisible();

    // Fixture spans today+1 22:00 → today+2 06:00, so the hover card's
    // end-day label is today+2. Verify both endpoints render so the test
    // proves the full cross-day range, not just one side of it.
    const start = fixtureBaseDate();
    start.setDate(start.getDate() + 1);
    const startMonth = start.toLocaleString('en-US', { month: 'short' });
    const startDay = start.getDate();

    const end = fixtureBaseDate();
    end.setDate(end.getDate() + 2);
    const endMonth = end.toLocaleString('en-US', { month: 'short' });
    const endDay = end.getDate();

    await expect(dialog).toContainText(new RegExp(`${startMonth}\\s+${startDay}`));
    await expect(dialog).toContainText(new RegExp(`${endMonth}\\s+${endDay}`));
  });

  test('mobile month pills keep visible title text', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/regression-bugs.html');

    const pill = page.getByRole('button', { name: /Mobile Pill Text/i }).first();
    await expect(pill).toBeVisible();
    await expect(pill).toHaveText(/Mobile Pill Text/);
  });

  test('edit pen opens the editor with the matching event loaded', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/regression-bugs.html');

    // Wait for the fixture to hydrate before clicking — the bare click was
    // racing the fixture's initial render in CI. The recurring-event test
    // below has the same fix (added inline to keep the diff narrow).
    const pen = page.getByRole('button', { name: /Edit Pen Fixture/i }).first();
    await expect(pen).toBeVisible({ timeout: 10000 });
    await pen.click();

    const dialog = page.getByRole('dialog', { name: /Event details: Edit Pen Fixture/i });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: /Edit event/i }).click();

    const editor = page.getByRole('dialog', { name: /Edit event/i });
    await expect(editor).toBeVisible();
    await expect(editor.getByPlaceholder('Event title')).toHaveValue('Edit Pen Fixture');
  });

  test('edit pen on a recurring event shows the series repeat cadence, not "Does not repeat"', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/regression-bugs.html');

    const pencil = page.getByRole('button', { name: /Repeating Pencil Test/i }).first();
    await expect(pencil).toBeVisible({ timeout: 10000 });
    await pencil.click();

    const dialog = page.getByRole('dialog', { name: /Event details: Repeating Pencil Test/i });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: /Edit event/i }).click();

    const editor = page.getByRole('dialog', { name: /Edit event/i });
    await expect(editor).toBeVisible();
    await expect(editor.getByPlaceholder('Event title')).toHaveValue('Repeating Pencil Test');

    // The Repeat dropdown must NOT show "Does not repeat" — the series RRULE should be loaded.
    const repeatSelect = editor.getByLabel(/^Repeat$/i);
    await expect(repeatSelect).not.toHaveValue('none');
  });
});
