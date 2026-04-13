import { expect, test } from '@playwright/test';

test.describe('CalendarExternalForm fixture', () => {
  test('submits successfully with adapter-backed flow', async ({ page }) => {
    await page.goto('/external-form-fixture.html');

    await page.getByLabel('Title').fill('Quarterly planning');
    await page.getByLabel('Start').fill('2026-04-20T09:00');
    await page.getByLabel('End').fill('2026-04-20T10:00');
    await page.getByLabel('Category').selectOption('Meeting');

    await page.getByRole('button', { name: 'Submit external event' }).click();

    await expect(page.getByRole('status')).toContainText('ext-quarterly-planning');
    await expect(page.getByTestId('submit-count')).toContainText('1');
    await expect(page.getByTestId('last-error')).toContainText('none');
  });

  test('blocks submit on validation errors', async ({ page }) => {
    await page.goto('/external-form-fixture.html');

    await page.getByRole('button', { name: 'Submit external event' }).click();

    await expect(page.getByText('Title is required.')).toBeVisible();
    await expect(page.getByText('Start is required.')).toBeVisible();
    await expect(page.getByText('End is required.')).toBeVisible();
    await expect(page.getByText('Category is required.')).toBeVisible();
    await expect(page.getByTestId('submit-count')).toContainText('0');
  });

  test('isolates adapter/network failures without crashing form workflow', async ({ page }) => {
    await page.goto('/external-form-fixture.html');

    await page.getByRole('button', { name: 'Use failing adapter' }).click();
    await expect(page.getByTestId('adapter-mode')).toContainText('failure');

    await page.getByLabel('Title').fill('Incident triage');
    await page.getByLabel('Start').fill('2026-04-21T11:00');
    await page.getByLabel('End').fill('2026-04-21T12:00');
    await page.getByLabel('Category').selectOption('Incident');

    await page.getByRole('button', { name: 'Submit external event' }).click();

    await expect(page.getByRole('alert')).toContainText('Simulated network failure');
    await expect(page.getByTestId('last-error')).toContainText('Simulated network failure');
    await expect(page.getByTestId('submit-count')).toContainText('1');

    await page.getByRole('button', { name: 'Use success adapter' }).click();
    await page.getByRole('button', { name: 'Submit external event' }).click();

    await expect(page.getByRole('status')).toContainText('ext-incident-triage');
    await expect(page.getByTestId('submit-count')).toContainText('2');
  });
});
