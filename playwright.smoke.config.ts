import { defineConfig } from '@playwright/test';

const smokeFiles = [
  'tests-e2e/calendar.demo.spec.ts',
  'tests-e2e/calendar.embed.spec.ts',
  'tests-e2e/calendar.regressions.spec.ts',
];

const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:3000';
const webServerCommand = process.env['E2E_WEB_SERVER_CMD'] ?? 'npm run dev -- --host localhost';

export default defineConfig({
  testDir: '.',
  testMatch: smokeFiles,
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'qa-output/playwright-smoke-report.json' }],
    ['html', { outputFolder: 'qa-output/html-report', open: 'never' }],
  ],
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  webServer: {
    command: webServerCommand,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
