import { test, expect } from '@playwright/test';

const ENV_NOISE_PATTERNS: RegExp[] = [
  /net::ERR_CERT_AUTHORITY_INVALID/i,
  /net::ERR_CERT_DATE_INVALID/i,
  /net::ERR_CERT_COMMON_NAME_INVALID/i,
];

function ignoreEnvNoise(line: string): boolean {
  return !ENV_NOISE_PATTERNS.some((re) => re.test(line));
}

test.describe('WorksCalendar demo', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('loads without crashing', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto('?embed=1');
    await expect(page.getByTestId('works-calendar')).toBeVisible();
    await expect(page.getByRole('toolbar', { name: /calendar navigation/i })).toBeVisible();
    expect(consoleErrors.concat(pageErrors).filter(ignoreEnvNoise)).toEqual([]);
  });

  test('main navigation buttons work', async ({ page }) => {
    await page.goto('?embed=1');
    const calendar = page.getByTestId('works-calendar');
    await expect(calendar).toBeVisible();

    const dateLabel = page.locator('[aria-live="polite"]').first();
    const before = (await dateLabel.textContent()) || '';

    await page.getByRole('button', { name: /^Next$/i }).first().click();
    await expect(dateLabel).not.toHaveText(before);

    await page.getByRole('button', { name: /^Today$/i }).click();
    await expect(calendar).toBeVisible();
  });

  test('all views can be selected', async ({ page }) => {
    await page.goto('?embed=1');

    for (const view of ['Month', 'Week', 'Day', 'Agenda', 'Schedule']) {
      const viewBtn = page.getByRole('button', { name: new RegExp(`^${view}$`, 'i') });
      await viewBtn.click();
      await expect(viewBtn).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('add event dialog opens', async ({ page }) => {
    await page.goto('?embed=1');
    await page.getByRole('button', { name: /^Month$/i }).click();
    const addBtn = page.getByRole('button', { name: /add new event/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    await expect(page.getByText(/save/i).first()).toBeVisible();
  });
});
