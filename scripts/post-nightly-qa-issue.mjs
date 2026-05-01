import fs from 'node:fs';

const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;

if (!repo || !token) {
  console.error('Missing GITHUB_REPOSITORY or GITHUB_TOKEN');
  process.exit(1);
}

const [owner, name] = repo.split('/');

function readSafe(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
}

const visual = readSafe('qa-output/visual-review.md');
const confused = readSafe('qa-output/confused-user/confused-user-notes.md');

function splitFindings(text) {
  const bugs = [];
  const polish = [];

  for (const line of text.split('\n')) {
    if (line.includes('[BUG]')) bugs.push(line);
    if (line.includes('[POLISH]')) polish.push(line);
  }

  return { bugs, polish };
}

const { bugs, polish } = splitFindings(visual);

const status = bugs.length > 0
  ? '🔴 Bugs Found'
  : polish.length > 0
    ? '🟡 Polish Only'
    : '🟢 Clean';

const body = `# WorksCalendar Nightly QA

Status: ${status}

## 🔴 Bugs to Fix First
${bugs.length ? bugs.join('\n') : 'None'}

## 🟡 Visual Polish
${polish.length ? polish.join('\n') : 'None'}

---

## 🧪 Confused User Notes
${confused || '_No confused-user output_'}

---

## 📸 Raw Visual QA
${visual || '_No visual QA output_'}
`;

async function run() {
  const search = await fetch(`https://api.github.com/search/issues?q=repo:${owner}/${name}+in:title+"Nightly QA Report"+state:open`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json());

  const labels = ['nightly-qa'];
  if (bugs.length) labels.push('bug');
  if (polish.length) labels.push('visual-polish');

  if (search.items?.length) {
    const issue = search.items[0];
    await fetch(`https://api.github.com/repos/${owner}/${name}/issues/${issue.number}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ body, labels })
    });
    console.log('Updated existing nightly QA issue');
  } else {
    await fetch(`https://api.github.com/repos/${owner}/${name}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Nightly QA Report',
        body,
        labels
      })
    });
    console.log('Created new nightly QA issue');
  }
}

run();
