# WorksCalendar Roadmap

_Last updated: 2026-04-20_

## Recently landed

- **Resource-booking hardening (Sprint 1–3):** approval-transition
  reducer (#209), capacity + business-hours rules (#212), hash-chain
  audit trail (#215), resource availability rules (#214), multi-tenant
  primitives (#218), indexed assignment lookups (#221).
- **Workflow DSL — Phase 1 (#219):** declarative approval workflows,
  safe expression evaluator, pure interpreter, three starter templates,
  and optional integration with `transitionApproval`. See
  [Workflow DSL guide](./Workflow.md).

## Next release targets

1. **Workflow DSL — Phase 2 (#219)**
   - Visual `WorkflowBuilder` editor in ConfigPanel.
   - Drag-drop canvas, node inspector, JSON import/export.
   - Stacks on Phase 1 without breaking persisted instances.
2. **Adapter expansion**
   - Harden local adapter examples into package-ready presets.
   - Add first-party integration path for Microsoft 365 data sync.
3. **Scheduling depth**
   - Expand schedule templates and shift rule ergonomics.
   - Improve manager workflows for handoff/coverage edits.
4. **Developer experience**
   - Provide copy-paste starter snippets per major use case.
   - Add stricter package-level publish checks.
5. **Quality and trust**
   - Keep release notes current per tag.
   - Continue visual QA and example parity checks.

## Triaging and issue labels

Recommended issue labels:

- `type:bug`
- `type:feature`
- `type:docs`
- `area:filters`
- `area:scheduling`
- `area:data-adapters`
- `good-first-issue`
- `needs-repro`
- `blocked`

## Definition of ready for release

- Package metadata matches npm best practices.
- README, docs index, and runnable examples stay aligned.
- Known roadmap priorities are publicly visible and date-stamped.
