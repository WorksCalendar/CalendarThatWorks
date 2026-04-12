import fs from 'fs';
import path from 'path';

const qaDir = path.resolve('qa');
const bugMemoryPath = path.join(qaDir, 'bug-memory.json');
const rubricPath = path.join(qaDir, 'qa-rubric.md');
const selectorsPath = path.join(qaDir, 'known-selectors.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function scoreBug(entry, text) {
  const hay = `${entry.title} ${entry.area} ${(entry.symptoms || []).join(' ')} ${(entry.expected_behavior || []).join(' ')}`.toLowerCase();
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean)
    .reduce((acc, token) => acc + (hay.includes(token) ? 1 : 0), 0);
}

function usage() {
  console.log('Usage: node scripts/generate-regression-prompt.mjs "bug description here"');
}

const bugText = process.argv.slice(2).join(' ').trim();
if (!bugText) {
  usage();
  process.exit(1);
}

const bugs = readJson(bugMemoryPath);
const rubric = readText(rubricPath);
const selectors = readJson(selectorsPath);

const similar = [...bugs]
  .map((entry) => ({ entry, score: scoreBug(entry, bugText) }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 4)
  .map((item) => item.entry);

const prompt = `You are helping generate a new Playwright regression test for WorksCalendar.\n\nNew bug report:\n${bugText}\n\nQA rubric:\n${rubric}\n\nKnown stable selectors:\n${JSON.stringify(selectors, null, 2)}\n\nMost similar prior bugs:\n${JSON.stringify(similar, null, 2)}\n\nInstructions:\n1. Propose the best target file for the new test.\n2. Explain what behavior should be asserted.\n3. Call out any flaky-risk selectors or assertions.\n4. Draft a Playwright test in the existing repo style.\n5. Say whether this should use test.fail(...) until the product bug is fixed.\n6. Keep all suggestions limited to test-only code and fixtures.\n`;

console.log(prompt);
