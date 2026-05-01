import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.join('qa-output', 'confused-user');
const NOTES_PATH = path.join(OUT_DIR, 'confused-user-notes.md');

type StepNote = {
  readonly step: string;
  readonly action: string;
  readonly expectation: string;
  readonly result: string;
};

async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    fullPage: true,
  });
}

async function safeClick(locator: Locator, label: string): Promise<string> {
  const count = await locator.count();
  if (count === 0) return `Skipped: no visible target found for ${label}.`;
  await locator.first().click();
  return `Clicked ${label}.`;
}

function writeNotes(notes: readonly StepNote[]): void {
  const body = [
    '# Confused User Walkthrough Notes',
    '',
    'This is intentionally exploratory. It checks whether a first-time user can discover the core product value without knowing WorksCalendar internals.',
    '',
    ...notes.flatMap((note, index) => [
      `## Step ${index + 1}: ${note.step}`,
      '',
      `- Action: ${note.action}`,
      `- Expected confused-user reaction: ${note.expectation}`,
      `- Result: ${note.result}`,
      '',
    ]),
  ].join('\n');
  fs.writeFileSync(NOTES_PATH, body, 'utf8');
}

test.describe('confused user QA', () => {
  test('first-time user explores the demo and captures discovery screenshots', async ({ page }) => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const notes: StepNote[] = [];

    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await screenshot(page, '01-home');
    notes.push({
      step: 'Landing page first impression',
      action: 'Opened the demo home page with no prior instructions.',
      expectation: 'A new user should understand what the product does and what to click first within a few seconds.',
      result: 'Captured 01-home.png for AI review.',
    });

    const startTarget = page
      .getByRole('button', { name: /demo|try|start|calendar|get started|launch/i })
      .or(page.getByRole('link', { name: /demo|try|start|calendar|get started|launch/i }));
    const startResult = await safeClick(startTarget, 'the most obvious start/demo control');
    await page.waitForTimeout(500);
    await screenshot(page, '02-after-first-click');
    notes.push({
      step: 'First obvious click',
      action: 'Clicked the first visible control that looked like a demo/start/calendar entry point.',
      expectation: 'The next screen should make the main job-to-be-done clearer, not simply expose more controls.',
      result: `${startResult} Captured 02-after-first-click.png.`,
    });

    const addTarget = page.getByRole('button', { name: /add|new|create|request/i });
    const addResult = await safeClick(addTarget, 'the first add/new/create/request control');
    await page.waitForTimeout(500);
    await screenshot(page, '03-add-or-request-flow');
    notes.push({
      step: 'Try to create something',
      action: 'Looked for an Add/New/Create/Request action and clicked the first match.',
      expectation: 'A new user should understand what kind of thing they are creating and why the fields matter.',
      result: `${addResult} Captured 03-add-or-request-flow.png.`,
    });

    const escapeResult = await page.keyboard.press('Escape').then(() => 'Pressed Escape to close any open modal or popover.');
    await page.waitForTimeout(300);
    await screenshot(page, '04-after-escape');
    notes.push({
      step: 'Recover from modal/popover',
      action: 'Pressed Escape after opening the create flow.',
      expectation: 'A confused user should be able to safely back out without losing the whole demo state.',
      result: `${escapeResult} Captured 04-after-escape.png.`,
    });

    for (const view of ['Schedule', 'Timeline', 'Assets', 'Dispatch', 'Requests', 'Map']) {
      const viewTarget = page.getByRole('button', { name: new RegExp(view, 'i') });
      const result = await safeClick(viewTarget, `${view} view`);
      await page.waitForTimeout(500);
      const fileSafeView = view.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await screenshot(page, `view-${fileSafeView}`);
      notes.push({
        step: `Discover ${view}`,
        action: `Tried to switch to the ${view} view using visible navigation.`,
        expectation: `The ${view} view should explain why it exists and what problem it solves.`,
        result: `${result} Captured view-${fileSafeView}.png.`,
      });
    }

    const settingsTarget = page.getByRole('button', { name: /settings|configure|customize/i });
    const settingsResult = await safeClick(settingsTarget, 'settings/configure/customize control');
    await page.waitForTimeout(500);
    await screenshot(page, '05-settings-discovery');
    notes.push({
      step: 'Settings discovery',
      action: 'Looked for settings/configuration to understand how embeddable setup works.',
      expectation: 'Configuration should feel organized enough that a buyer can imagine embedding it in their own app.',
      result: `${settingsResult} Captured 05-settings-discovery.png.`,
    });

    writeNotes(notes);
    expect(fs.existsSync(NOTES_PATH)).toBe(true);
  });
});
