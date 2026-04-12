import fs from 'fs';
import OpenAI from 'openai';

const REPORT_PATH = 'qa-output/playwright-report.json';
const OUTPUT_PATH = 'qa-output/ai-qa-notes.md';

const client = new OpenAI({
  baseURL: 'http://192.168.68.61:1234/v1',
  apiKey: 'lm-studio',
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function flattenReport(report) {
  const out = [];

  function walkSuite(suite, prefix = '') {
    const suiteTitle = [prefix, suite.title].filter(Boolean).join(' > ');

    if (suite.specs) {
      for (const spec of suite.specs) {
        const specTitle = [suiteTitle, spec.title].filter(Boolean).join(' > ');

        for (const t of spec.tests || []) {
          const results = t.results || [];
          const statuses = results.map((r) => r.status).filter(Boolean);
          const errors = results.flatMap((r) =>
            (r.errors || []).map((e) => e.message || JSON.stringify(e)),
          );

          out.push({
            title: specTitle,
            projectName: t.projectName || '',
            status: statuses.includes('failed')
              ? 'failed'
              : statuses.includes('timedOut')
                ? 'timedOut'
                : statuses.includes('passed')
                  ? 'passed'
                  : 'unknown',
            errors,
          });
        }
      }
    }

    for (const child of suite.suites || []) {
      walkSuite(child, suiteTitle);
    }
  }

  for (const suite of report.suites || []) {
    walkSuite(suite);
  }

  return out;
}

async function main() {
  const report = readJson(REPORT_PATH);
  const tests = flattenReport(report);

  const screenshots = fs.existsSync('qa-output')
    ? fs.readdirSync('qa-output').filter((f) => f.endsWith('.png'))
    : [];

  const prompt = `
You are a senior frontend QA reviewer.

You are reviewing Playwright results for WorksCalendar, a Vite/React embeddable calendar demo.

Return markdown with exactly these sections:

# AI QA Notes
## Overall Status
## Critical Issues
## Important Issues
## Cosmetic / Lower Priority
## Likely Root Causes
## Recommended Next Fixes
## Suggested Additional Tests

Be practical and specific.
Focus on:
- viewport/layout issues
- toolbar/nav failures
- view switching bugs
- add-event modal issues
- accessibility or focus issues
- console/runtime errors
- likely CSS overflow or state bugs

Test results:
${JSON.stringify(tests, null, 2)}

Screenshots captured:
${JSON.stringify(screenshots, null, 2)}
`;

  const response = await client.chat.completions.create({
    model: process.env.LM_STUDIO_MODEL || 'local-model',
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: 'You are an expert QA engineer and frontend debugger.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const text = response.choices?.[0]?.message?.content || 'No response returned.';
  fs.writeFileSync(OUTPUT_PATH, text, 'utf8');
  console.log(text);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
