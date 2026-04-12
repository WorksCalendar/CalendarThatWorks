# QA generation rubric

Use this rubric whenever you generate or review new Playwright regression tests for WorksCalendar.

## Goals

- Catch real user-facing bugs.
- Prefer stable selectors and stable assertions.
- Avoid flaky tests that fail for unrelated UI noise.
- Keep test-only tooling out of shipped calendar runtime code.

## Selector rules

1. Prefer accessible selectors first.
   - `getByRole(...)`
   - `getByLabel(...)`
   - `getByPlaceholder(...)`
   - `getByTestId(...)`
2. Use exact button names when a partial match can hit multiple controls.
3. Avoid CSS module hash class names.
4. Prefer stable attributes already present in the component tree:
   - `data-testid="works-calendar"`
   - `data-date="YYYY-MM-DD"`
   - dialog names and button aria-labels

## Assertion rules

1. Assert user-visible behavior, not implementation trivia.
2. For crash bugs, always capture:
   - `pageerror`
   - console errors
   - final visibility of the calendar root
3. For visual/layout bugs, combine:
   - DOM assertions
   - bounding-box checks
   - screenshots
4. For edit/open flows, assert the correct dialog opens with the correct record loaded.
5. For mobile bugs, test at both `320x640` and `390x844` when practical.
6. For embed bugs, test both:
   - direct demo page
   - iframe host page

## Known good patterns

- Use `test.fail(...)` for confirmed open bugs so they stay visible without breaking the full suite.
- Add a dedicated regression fixture page when a bug needs predictable sample data.
- Keep targeted bug tests in `tests-e2e/calendar.regressions.spec.ts` unless they deserve their own file.

## Flake warnings

Be cautious when a test depends on:

- animated transitions without waiting for a stable post-state
- text that may appear in multiple controls
- current clock time without normalizing expectations
- browser-specific drag behavior without checking final state

## Review checklist for generated tests

Before accepting a generated test, check:

- Does it reproduce a real bug or risk?
- Are the selectors stable?
- Is the assertion about behavior users care about?
- Will the test still make sense 3 months from now?
- Does it belong in the main suite, or should it be isolated as a known-bug regression?
