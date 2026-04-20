# Workflow DSL — Sprint Plan to Close Epic #219

## Context

Epic #219 (Workflow / Approval DSL) is split into four phases. Current
state on 2026-04-20:

| Phase | Issue | State | Notes |
|---|---|---|---|
| P1 JSON schema + interpreter | #220 | **Closed** | commit `da05b47` |
| P2 Visual builder | #221 | **Implemented, not merged** | current branch `claude/plan-phase-2-visual-builder-ggFY5` |
| P3 SLA timers + escalation | #222 | Not started | |
| P4 Branching, parallel, notify | #223 | Not started | |

User goal: close #221, #222, #223 (and therefore the epic #219) in
order, on a fresh branch per sprint. This plan lays out five sprints.

### Relevant pieces already in place

Confirmed by reading the codebase:

- **EventBus (#216 prereq)** — `src/core/events/eventBus.ts` is built
  and tested but **not yet published to** from the approval reducer or
  workflow interpreter. Subscribe API is stable.
- **`slaMinutes` / `onTimeout` fields** — already on
  `WorkflowApprovalNode` (`src/core/workflow/workflowSchema.ts:42-44`)
  and rendered in `WorkflowNodeInspector.tsx:200-236` (UI labels them
  "Phase-3 feature; stored but not yet enforced"). Schema work for P3
  is mostly done — only runtime enforcement is missing.
- **`notify` node schema** — present
  (`src/core/workflow/workflowSchema.ts:47-52`); `advance.ts:255-261`
  already emits a `WorkflowEmitEvent` with type `'notify'`. No channel
  dispatch exists.
- **Expression evaluator** — `src/core/workflow/expression.ts`
  `evaluate(expr, vars)` is reusable; #223's template interpolation
  will be a small wrapper that regex-extracts `{{...}}` and delegates
  to `evaluate`.
- **AuditDrawer** — `src/views/AuditDrawer.tsx:87-125` already renders
  per-step times; `.entryMeta` (`AuditDrawer.module.css:130-134`) is
  the natural attachment point for an SLA countdown pill.
- **Adapter precedent** — props-callback pattern (`onApprovalAction`
  in `src/WorksCalendar.tsx:188`) is the template for #222's
  `onTick`; `CalendarAdapter` (`src/api/v1/adapters/CalendarAdapter.ts`)
  is the template for #223's channel registry.

## Branching strategy

One branch/PR per sprint so each lands reviewable-sized. All five
branch off `main`.

```
main
├── claude/plan-phase-2-visual-builder-ggFY5   (Sprint A — already has P2 work)
├── claude/workflow-eventbus-wiring            (Sprint B)
├── claude/workflow-p3-sla-timers              (Sprint C — #222)
├── claude/workflow-p4-parallel-and-channels   (Sprint D — #223)
└── claude/workflow-epic-close                 (Sprint E — doc + close-out)
```

Each PR references "Closes #NNN" so GitHub auto-closes on merge; the
epic #219 closes with Sprint E.

---

## Sprint A — Land P2 Visual Builder · Closes #221

**Effort: ~½ day (review turnaround only; code is done).**

The work on `claude/plan-phase-2-visual-builder-ggFY5` is complete:
- `src/core/workflow/validate.ts`, `layout.ts`, `__tests__/*`
- `src/ui/WorkflowBuilderModal.tsx`, `WorkflowCanvas.tsx`,
  `WorkflowNodeInspector.tsx`, `WorkflowEdgeGuardPicker.tsx`,
  `WorkflowSimulator.tsx`
- `src/hooks/useSavedWorkflows.ts`
- `src/ui/ApprovalFlowsTab.tsx` (lazy) + `ConfigPanel.tsx` integration
- `tests-e2e/workflow-builder.spec.ts` (mouse + keyboard-only)
- `docs/bundle-size-audit.md` (main-chunk delta +0.24 kB gzip,
  lazy chunks 17.83 kB gzip total — within the ≤2 kB main-chunk budget)
- P2-review Escape-layering fix (`WorkflowBuilderModal.tsx`) + test

Actions:
1. Open PR from `claude/plan-phase-2-visual-builder-ggFY5` → `main`
   with body "Closes #221". Attach bundle audit numbers.
2. Respond to review; merge.

Verification: all unit + component + e2e suites green at merge
(already green locally).

---

## Sprint B — EventBus wiring (bridge)

**Effort: ~1 day. Fresh branch: `claude/workflow-eventbus-wiring`.**

**Why first:** the bus
(`src/core/events/eventBus.ts`) is the published prerequisite for #222
and #223, but nothing currently publishes to it. #222's timeout events
and #223's notify-channel dispatch both want to hang off the bus, so
wiring it in once (here) avoids re-plumbing twice.

### Files

- `src/core/events/eventBus.ts` — extend `LifecycleEventType` union
  with workflow-scoped events:
  ```ts
  | { type: 'workflow.instance.started';   at: string; instanceId: string; workflowId: string }
  | { type: 'workflow.node.entered';       at: string; instanceId: string; nodeId: string }
  | { type: 'workflow.node.exited';        at: string; instanceId: string; nodeId: string; signal: EdgeGuard }
  | { type: 'workflow.instance.completed'; at: string; instanceId: string; outcome: WorkflowOutcome }
  ```
  (These are strictly additive — existing `booking.*` events untouched.)

- `src/core/workflow/advance.ts` — accept an optional
  `bus?: LifecycleEventBus` field on `AdvanceInput`. On each
  `enter`/`exitCurrent` call, `bus?.publish({...})`. Pure by default
  (no bus passed → identical behavior to today). Phase 1 tests stay
  green.

- `src/core/approval/*` reducer publish sites — wire the bus through
  the engine's approval reducer for `booking.requested/approved/denied/finalized/cancelled`.
  (This is actually what issue #216 intended — the bus exists but
  never fires.)

- `src/WorksCalendar.tsx` — expose the bus via a new prop
  `workflowEventBus?: LifecycleEventBus` (optional; host can pass one
  in or ignore). Default: internal bus, unsubscribed.

### Tests

- `src/core/events/__tests__/eventBus.test.ts` — extend coverage for
  the workflow-scoped events.
- `src/core/workflow/__tests__/advance.busPublish.test.ts` — new: pass
  a spy bus, assert `workflow.node.entered` emits in order matching
  `WorkflowEmitEvent` stream.

### Verification

- `npm run test` green.
- `npm run type-check` clean.
- No bundle regression (bus is ~1.5 kB gzip already counted).

Open PR with body "Bridges #216 into workflow runtime — prereq for
#222 and #223." (Does not close any issue on its own.)

---

## Sprint C — P3 SLA timers + escalation · Closes #222

**Effort: ~3–4 days. Fresh branch: `claude/workflow-p3-sla-timers`.**

### Runtime (core)

- `src/core/workflow/workflowSchema.ts`
  - Add `'timeout'` to the `WorkflowAction['type']` union.
  - Add `'timeout'` to the `EdgeGuard` union.

- `src/core/workflow/advance.ts`
  - Handle `type: 'timeout'` in `advance()`. Behavior follows
    `approval.onTimeout`:
    - `escalate` → walk an edge with `when: 'timeout'` (error if none
      at validate-time); current node exits with signal `'timeout'`.
    - `auto-approve` / `auto-deny` → walk the standard
      `approved`/`denied` edge (reuses existing `resolveNextEdge`).
  - New pure function:
    ```ts
    export function tick(
      workflow: Workflow,
      instance: WorkflowInstance,
      nowIso: string,
    ): AdvanceResult | null
    ```
    Returns a `timeout` advance result if the currently-awaited
    approval step's `slaMinutes` has elapsed since its
    `history[-1].enteredAt`; otherwise `null`. Pure — host drives via
    a `setInterval` or external scheduler.

- `src/core/workflow/validate.ts`
  - New rule `timeout-edge-missing` (severity: **error** when
    `onTimeout === 'escalate'` and no outgoing `when:'timeout'` edge;
    severity: **warning** when `slaMinutes` is set but no `onTimeout`
    configured).
  - Extend `illegal-guard-for-source` so `'timeout'` is only valid
    out of an `approval` node that has `slaMinutes` set.

### Host adapter

- `src/WorksCalendar.tsx` — add a prop:
  ```ts
  readonly onWorkflowTick?: (instance, nowIso) => AdvanceResult | null
  ```
  and/or a bundled helper
  `useWorkflowTicker(intervalMs = 60_000)` that calls `tick()`
  internally on `setInterval`. Follows `onApprovalAction` precedent
  (`src/WorksCalendar.tsx:188`). Host opts in — silent no-op by
  default.

### UI

- `src/ui/WorkflowEdgeGuardPicker.tsx` — add `'timeout'` to available
  guards when source is an approval node with `slaMinutes > 0`.
- `src/ui/WorkflowNodeInspector.tsx` — remove the "Phase-3 feature;
  stored but not yet enforced" copy once runtime lands
  (`WorkflowNodeInspector.tsx:200-220`).
- `src/ui/WorkflowSimulator.tsx` — new "Advance clock by…" control so
  authors can test timeout paths without real-time waits; calls
  `tick()` with a synthetic `nowIso`.
- `src/views/AuditDrawer.tsx` — SLA countdown pill on the active
  approval entry. Compute `slaMinutes - (now - enteredAt)`; render in
  `.entryMeta` (`AuditDrawer.module.css:130-134`). Red styling when
  negative.

### Templates

- `src/core/workflow/templates.ts` — extend `conditionalByCostWorkflow`:
  add `slaMinutes: 240, onTimeout: 'escalate'` on the director step
  plus a `timeout` edge to a new `escalated` approval.

### Tests

- `src/core/workflow/__tests__/tick.test.ts` (new) — tick before SLA
  returns null; tick after SLA returns timeout action; each
  `onTimeout` behavior reaches the expected terminal; cycle-guard.
- `src/core/workflow/__tests__/validate.test.ts` — cover new rules.
- `src/ui/__tests__/WorkflowSimulator.test.tsx` — Advance-clock
  exercises timeout path.
- `tests-e2e/workflow-builder.spec.ts` — extend: author adds timeout
  edge via picker, simulates elapsed SLA, asserts `timeout` emit.

### Bundle budget

Re-run the audit. Main-chunk delta expected negligible (tick + schema
deltas are tiny); simulator-side "Advance clock" adds <0.5 kB to the
lazy builder chunk.

### Verification

- `npm run test`, `npm run type-check`, `npm run test:browser`.
- Manual: fork `conditional-by-cost`, set director SLA to 1 min,
  simulate via Advance-clock, observe `timeout` path.

Open PR, body "Closes #222."

---

## Sprint D — P4 parallel + channels + notify dispatch · Closes #223

**Effort: ~5–7 days. Fresh branch: `claude/workflow-p4-parallel-and-channels`.**

Two concerns in one issue: parallel branching *and* notify-channel
dispatch. Splitting into sub-PRs if review fatigue becomes a risk.

### Schema (additive)

- `src/core/workflow/workflowSchema.ts` — add:
  ```ts
  interface WorkflowParallelNode {
    readonly id: string
    readonly type: 'parallel'
    readonly branches: readonly string[]   // target node ids
    readonly mode: 'requireAll' | 'requireN' | 'requireAny'
    readonly n?: number                    // required when mode='requireN'
    readonly label?: string
  }
  interface WorkflowJoinNode {
    readonly id: string
    readonly type: 'join'
    readonly pairedWith: string            // id of originating parallel node
    readonly label?: string
  }
  ```
- New `EdgeGuard`: `'branch-completed'` for join-incoming edges.

### Interpreter

- `src/core/workflow/advance.ts`
  - `autoAdvance` on `parallel`: enter each branch, track branch
    states in `instance.parallelState: Record<parallelId, Set<doneBranchId>>`
    (additive field on `WorkflowInstance` — deep-frozen).
  - On child-branch completion, emit `branch-completed` edge into the
    paired join; advance join only when `mode` quorum met.
  - Keep cycle-guard; count parallel branches toward the bound.

### Channel registry

- `src/core/workflow/channels.ts` (new) — adapter interface:
  ```ts
  interface WorkflowChannelAdapter {
    readonly id: string                            // matches node.channel
    dispatch(payload: { template?: string; vars: Record<string, unknown>; at: string }): Promise<void>
  }
  export function registerWorkflowChannel(adapter: WorkflowChannelAdapter): void
  export function listChannels(): readonly WorkflowChannelAdapter[]
  ```
- Built-in adapters (thin, host-configured):
  - `src/core/workflow/channels/webhook.ts` — POSTs JSON to a URL
  - `src/core/workflow/channels/slack.ts` — webhook wrapper shaping the
    Slack message payload
  - `src/core/workflow/channels/email.ts` — emits an SMTP-shaped
    payload for the host to relay
- `advance.ts` on entering a `notify` node: if the bus is present,
  publish `workflow.notify.dispatched`; fire-and-forget
  `dispatch(...)` on the matching registered channel. Errors are
  isolated — recorded in history as an emit event with `error: string`
  but do **not** block the flow (per #223 acceptance criteria).

### Template interpolation

- `src/core/workflow/templateInterpolate.ts` (new):
  ```ts
  export function interpolateTemplate(template: string, vars: Record<string, unknown>): string
  ```
  Regex-extracts `{{expr}}`, delegates to `expression.evaluate(expr, vars)`,
  stringifies results. Handles escaped `\{\{…\}\}` as a literal.
- Reuse `evaluate` at `src/core/workflow/expression.ts:340-351`.

### Validator

- New rules:
  - `parallel-join-unpaired` (error) — every `parallel` must be paired
    with exactly one `join.pairedWith = parallel.id`; every `join` must
    reference an existing `parallel`.
  - `parallel-branches-rejoin` (error) — each branch from a
    `parallel` must reach its paired `join` before any terminal.
  - `parallel-require-n-bounds` (error) — when `mode='requireN'`, `1 ≤
    n ≤ branches.length`.
  - `unknown-channel` (warning) — `notify.channel` doesn't match any
    registered adapter id (warn at validate-time — strict at runtime
    is host's call).
  - `template-syntax` (error) — `interpolateTemplate` fails to parse.

### Layout + canvas

- `src/core/workflow/layout.ts` — treat parallel as a standard
  fan-out source; join as a fan-in target. Existing BFS handles both;
  only rendering changes needed.
- `src/ui/WorkflowCanvas.tsx:385-389` — two new `kindClass` branches.
- `src/ui/WorkflowCanvas.module.css` — add `.nodeKindParallel` +
  `.nodeKindJoin` with distinct color + diamond/inverted-diamond hint
  via SVG path swap in Canvas render branch.

### Inspector + picker

- `src/ui/WorkflowNodeInspector.tsx` — add parallel (`mode`, `n`,
  `branches`-summary) and join (`pairedWith` dropdown filtered to
  parallel nodes) forms.
- `src/ui/WorkflowEdgeGuardPicker.tsx` — parallel-out edges accept
  `'default'` only; join-in edges accept `'branch-completed'` only.
- `src/ui/WorkflowBuilderModal.tsx` — add parallel/join buttons to
  node-add palette.

### Templates

- `src/core/workflow/templates.ts` — add
  `parallelSecurityAndFinanceApproval`: parallel (requireAll) fans out
  to security + finance approvals, joins, then terminal. Validates
  clean.

### Tests

- `src/core/workflow/__tests__/advance.parallel.test.ts` — 2-of-3
  requireN finalizes when 2 approve regardless of order; requireAny
  short-circuits; requireAll waits.
- `src/core/workflow/__tests__/templateInterpolate.test.ts` — happy
  path + escape + missing var passthrough.
- `src/core/workflow/__tests__/channels.test.ts` — registry
  register/list/dispatch isolation when one channel throws.
- `src/core/workflow/__tests__/validate.test.ts` — all four new rules.
- `src/ui/__tests__/WorkflowCanvas.test.tsx` — parallel/join render +
  palette buttons.
- `tests-e2e/workflow-builder.spec.ts` — fork the new parallel
  template, simulate full run, verify two simultaneous awaits.
- Slack channel e2e via mock webhook (per #223 acceptance): nock or
  simple `http.createServer` fixture in `tests-e2e/support/`.

### Bundle budget

Parallel + join add ~2 kB gzip to the lazy builder chunk; channel
registry is in the main chunk (small, ~0.5 kB gzip) since hosts may
want to register channels at app boot. Re-audit in
`docs/bundle-size-audit.md`.

### Verification

- `npm run test`, `npm run type-check`, `npm run test:browser`.
- Manual: build a parallel workflow, register a mock webhook channel,
  simulate, assert webhook receives payload with interpolated
  template.

Open PR, body "Closes #223."

---

## Sprint E — Close the epic · Closes #219

**Effort: ~½ day. Fresh branch: `claude/workflow-epic-close`.**

Only if any docs/readme updates remain after Sprints A–D. Otherwise
just a GitHub close-out:

1. Verify #220, #221, #222, #223 are all closed.
2. Post a summary comment on #219 linking each sub-issue's landing
   PR + commit hashes.
3. Close #219 via GitHub UI (or via PR body `Closes #219` if any docs
   ship in this sprint).
4. Update the `README.md` feature list — workflow engine ships with
   SLA timers, parallel approvals, and pluggable channels.
5. Update `docs/bundle-size-audit.md` with the final post-P4 snapshot.

---

## Out of scope (deferred beyond #219)

- Multi-step undo in the visual builder (single-level delete undo
  ships in P2).
- In-flight instance migration when a saved workflow is edited
  (Phase 2 surfaces a post-save toast only).
- Slack channel with OAuth token flow (P4 ships webhook-based Slack
  only — deeper integration is a separate issue).
- Per-instance SLA pause/resume (out-of-hours handling) — future
  issue.

---

## Verification across the full epic

After Sprint D merges (i.e. #219 substantively closed):

1. `npm run test` — all unit + component suites green (≥1700 tests
   post-P4).
2. `npm run type-check` clean under strict.
3. `npm run test:browser` — mouse, keyboard, SLA-timeout, parallel
   workflow e2e scenarios all green.
4. `npm run build` — main chunk delta vs. pre-P2 baseline ≤3 kB
   gzipped; visual-builder lazy chunk ≤25 kB gzipped; channel
   registry fits in main chunk (<1 kB gzip).
5. Manual demo walkthrough: fork `parallelSecurityAndFinanceApproval`,
   edit director SLA, register a mock webhook, simulate cost=1000 →
   approvals → notifies → completed.

## Critical files summary

**Sprint B** — `src/core/events/eventBus.ts`, `src/core/workflow/advance.ts`, `src/core/approval/*`, `src/WorksCalendar.tsx`.

**Sprint C** — `src/core/workflow/{workflowSchema,advance,validate,templates}.ts`, `src/ui/{WorkflowEdgeGuardPicker,WorkflowNodeInspector,WorkflowSimulator}.tsx`, `src/views/AuditDrawer.tsx`, `src/WorksCalendar.tsx`.

**Sprint D** — `src/core/workflow/{workflowSchema,advance,validate,templates,templateInterpolate,channels}.ts` + `channels/{webhook,slack,email}.ts`, `src/ui/{WorkflowCanvas,WorkflowNodeInspector,WorkflowEdgeGuardPicker,WorkflowBuilderModal}.tsx`, `src/ui/WorkflowCanvas.module.css`.
