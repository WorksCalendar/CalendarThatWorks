# Stage 4a + Stage 5 TypeScript Strict Migration Plan

## ⚠️ Post-Sprint Reality Check (updated 2026-04-22)

Stage 5 work (PRs 4–12) is complete and ratchet-enforced.

However, an attempted Stage 6 transition (root `noImplicitAny` flip + removal of the ratchet)
caused CI failures due to implicit-any debt outside migrated paths.

That change has been **rolled back**, and the repo remains in the staged migration model.

---

## Current State

| Area | Status |
|-----|--------|
| Stage 5 (UI + Views + Root + Demo) | ✅ Complete |
| MIGRATED_PATHS enforcement | ✅ Active |
| Strict CI ratchet | ✅ Active |
| Root `tsc` | 🟡 Advisory |
| Stage 6 (root strict) | ❌ Not complete |

---

## Key Clarification

Completion of PRs 10–12 does **not** mean the migration is fully collapsed.

It means:

> The migration is complete **under the ratchet model**

NOT:

> The repo is fully strict at the root level

---

## Enforcement Rule (NEW)

A PR or stage is only considered complete when:

- Files are in `MIGRATED_PATHS`
- `type-check:strict` passes
- CI enforces the result

Root config changes (like enabling `noImplicitAny`) are **out of scope** unless explicitly part of Stage 6.

---

## Stage 6 Status

Stage 6 is deferred and must be handled as a separate effort.

It requires:
- full-repo measurement
- explicit cleanup plan
- dedicated PR

---

## Recommendation

Continue operating under the ratchet model until a full Stage 6 readiness audit is completed.

---

## Purpose
This document defines the PR-by-PR execution plan to complete Stage 4a (decision + prep) and Stage 5 (UI strict migration).

This plan MUST be followed strictly. The goal is controlled, measurable progress — not speed.

---

## 🔁 Lessons Learned (DO NOT SKIP)
From the earlier TypeScript migration work:

- Small PRs win. Large PRs hide problems.
- Boundary typing matters more than internal perfection.
- `any` spreads silently — every PR must reduce or isolate it.
- Advisory root `tsc` catches integration issues early.
- “Looks typed” is not the same as “is safe.”

### Hard Rules
- No file-wide `: any`
- No implicit `any` in exported functions
- No new `any` without justification comment
- Do NOT “fix everything” in one PR
- If typing cascades → STOP and isolate

---

## ✅ Definition of Done (STRICT)
A PR is NOT done unless ALL are true:

1. `npm run type-check:strict` passes
2. Root advisory `tsc --noEmit` passes
3. Tests pass (touched scope minimum)
4. No increase in uncontrolled `any`
5. All new types are intentional and named
6. Public interfaces are explicitly typed
7. PR scope matches plan (no scope creep)

If ANY of these fail → PR is NOT DONE.

### Status Interpretation Note (added 2026-04-21)
For Stage 5 PRs, a checkmark is only valid once the migrated files are added to
`MIGRATED_PATHS` in `scripts/typecheck-strict.mjs`. Code-only typing progress
without the ratchet update is tracked as **Partially complete**.

### Review Reconciliation Note (updated 2026-04-21)
The status lines below were reconciled against the current repo state by checking:
- the live `MIGRATED_PATHS` allowlist in `scripts/typecheck-strict.mjs`
- the current code in the Stage 5 files
- the merged PR sequence that landed the related changes

These statuses reflect the repo **as it exists now**, not the state of the first PR that introduced each slice.

---

## 🧱 Stage 4a — Decision + Prep

### PR 1 — Stage 4 Decision
- Lock Path A
- Document Stage 5 order
- Define per-PR `any` budget
- Add checklist to migration doc

**Status:** ✅ Completed (2026-04-21)

**Decision recorded in `docs/TypeScriptStrictMigration.md`:**
- **Path A is locked** for this roadmap (continue into Stage 5).
- Stage 5 PR order is fixed as PRs 4 → 12 below.
- Stage 5 per-PR `any` budget is fixed to keep ratchet pressure:
  - PR 4–8, 10: max **+4** each
  - PR 9 (TimelineView isolated): max **+6**
  - PR 11 (WorksCalendar phase 2): max **+3**
  - PR 12 (final ratchet): **0 net new `any`** (cleanup only)
- Stage-level cap remains ≤ 40 additional `any` sites.

### PR 2 — Shared UI Types
- Event handler types
- Shared props
- UI data shapes
- Loose but intentional boundary types

**Status:** ✅ Completed (2026-04-21)

**Shipped in this PR:**
- Added shared UI boundary types in `src/types/ui.ts`:
  - `ConfigPanelProps` + `ConfigPanelTabId`
  - Saved-view seam types (`SavedViewDraft`, `SaveViewOptions`, handlers)
  - Source/template draft shapes
  - Shared event/update handler aliases (`UpdateConfig`, `InputChangeHandler`, `ToggleHandler`)
- Switched `ConfigPanel` from file-level props `: any` to `ConfigPanelProps`.
- Re-exported shared UI types from `src/index.ts` for downstream consumers.

**Completion updates in the current repo:**
- `src/types/**` and `src/index.ts` are already under the strict ratchet from Stage 1.
- `src/ui/ConfigPanel.tsx` is now present in `MIGRATED_PATHS`, so the shared UI seam introduced here is now enforced by the current migration harness.

### PR 3 — ConfigPanel Seam
- Create `ConfigPanelProps`
- Type top-level state
- Extract sub-component prop types
- REMOVE file-level `any`

**Status:** ✅ Completed (2026-04-21)

**Shipped in this PR:**
- Added explicit seam prop types in `src/ui/ConfigPanel.tsx` for the main panel and tab-level sections.
- Replaced ad-hoc `: any` signatures on ConfigPanel tab components with typed props.
- Typed local seam state like `openSections`, `tabRefs`, and section toggling.
- Intentionally kept `config` and `UpdateConfig` boundary-loose to prevent a cross-module typing cascade.

**Completion updates in the current repo:**
- `src/ui/ConfigPanel.tsx` is present in `MIGRATED_PATHS`, so the seam work from PR 3 is ratchet-enforced in the current repo.

---

## 🚀 Stage 5 — UI Migration

### PR 4 — ConfigPanel (Simple Tabs)
- SetupTab
- HoverCardTab
- DisplayTab
- AccessTab

Goal: Easy wins, stabilize patterns

**Status:** ✅ Completed (2026-04-21)

... (rest of file unchanged) ...
