# Works Calendar — Data Flow Diagrams

Three levels of DFD covering the full library. Context (Level 0) → subsystems
(Level 1) → internals of the four most complex subsystems (Level 2).

> **Architecture status**: Diagrams below reflect the **target architecture**
> after the three-sprint refactor (see CHANGELOG `[0.7.0]`), with one further
> decomposition pass applied to `WorksCalendar.tsx` (now ~500 lines). The key
> structural changes from the audit:
> - `CalendarEngine` is now the **sole** source of truth for view, cursor, and
>   base filter state. The legacy `useCalendar` hook and its parallel state are gone.
> - `useCalendarEngine` owns engine setup and the undo/redo stack. Mutation
>   handlers, schedule templates, and keyboard undo/redo are in `useCalendarMutations`.
> - `WorksCalendar.tsx` orchestration is now split across four dedicated hooks:
>   - `useCalendarSetup` — owner config, theme, employees, schema, nav state
>   - `useCalendarWorkspace` — perms, saved views, sidebar, grouping, cascade filters
>   - `useCalendarDataPipeline` — event aggregation, engine sync, view scoping, filtering
>   - `useCalendarMutations` — event/schedule mutations, templates, undo shortcut, date-select handlers
> - Left-rail and right-panel rendering extracted to `ui/CalendarSideRails.tsx`.
> - `useOccurrences` deleted; all views use the engine's `getOccurrencesInRange`
>   read path exclusively.
> - `CalendarContextValue` is fully typed — no more `[key: string]: any` escape hatch.
>
> **Note**: Diagrams 3b (React Hook Subscription Chain) and 3e (Initialization
> Sequence) predate the `useCalendarSetup` / `useCalendarWorkspace` /
> `useCalendarMutations` split and show the earlier single-hook structure.

---

## Level 0 — Context Diagram

The library as a single process interacting with the world.

![Level 0 — Context Diagram](diagrams/level0.png)

**External entities**

| Entity | Data In | Data Out |
|---|---|---|
| Host App | `events[]`, `config`, adapter, filter schema, slot renderers | `visibleEvents[]`, callbacks (onClick, onSave, onDelete, onModeChange) |
| Remote Data Source | Adapter pull results (loadRange) or push (subscribe) | CRUD operations from SyncManager |
| Browser Storage | — | Persisted config, pools, profile, saved views |
| External Channels | — | Booking lifecycle notifications (approve, deny, cancel) |

---

## Level 1 — Subsystem Diagram

Seven major subsystems inside the library and the data flows between them.

![Level 1 — Subsystem Diagram](diagrams/level1.png)

### Subsystem summary

| # | Subsystem | Key inputs | Key outputs |
|---|---|---|---|
| 1 | Adapter Layer | Remote events, config | `CalendarEventV1[]`, `AdapterChange` stream |
| 2 | Calendar Engine | `EngineOperation`, config | `CalendarState`, `OperationResult`, lifecycle emits |
| 3 | Occurrence Expansion | `EngineEvent[]`, date range | `EngineOccurrence[]` (rrule-expanded) |
| 4 | Filter & Grouping | Occurrences, filter state, schema | `visibleEvents[]`, grouped rows |
| 5 | View Layer | `visibleEvents[]`, cursor, view type | Rendered calendar; user event callbacks |
| 6 | Workflow & Approvals | Transition actions, workflow DSL | Updated `ApprovalStage`, audit trail, channel emits |
| 7 | Config & Persistence | `config.json`, localStorage | Parsed config, themes, pools, profile |
| 8 | Source Aggregation | ICS feeds, CSV sources, `useSourceStore` | Colour-tagged `NormalizedEvent[]`, `CalendarLegend` data |
| 9 | Notifications | `visibleEvents[].reminders`, `onReminder` prop | Browser `Notification`, host callback |
| 10 | Network Status | `navigator.onLine`, browser events | `isOnline` / `isInitializing` state, `OfflineIndicator` |

---

## Level 2 — Subsystem Internals

Detailed flows for all major subsystems: engine (2a), occurrence/filter (2b), adapter/sync (2c), workflow/approvals (2d), view layer (2e), config/persistence (2f), conflict engine (2g), requirements engine (2h), geo conflicts (2i), pool query DSL (2j).

---

### 2a — Calendar Engine + Orchestration Hook (Subsystems 1 + 2, post-Sprint-2/3)

![2a — Calendar Engine + Orchestration Hook](diagrams/level2a.png)

---

### 2b — Occurrence Expansion & Filtering (Subsystems 3 + 4)

![2b — Occurrence Expansion & Filtering](diagrams/level2b.png)

---

### 2c — Adapter Layer & Sync (Subsystem 1)

![2c — Adapter Layer & Sync](diagrams/level2c.png)

---

### 2d — Workflow & Approval System (Subsystem 6)

![2d — Workflow & Approval System](diagrams/level2d.png)

---

### 2e — View Layer (Subsystem 5)

![2e — View Layer](diagrams/level2e.png)

---

### 2f — Config & Persistence (Subsystem 7)

![2f — Config & Persistence](diagrams/level2f.png)

---

### 2g — Conflict Engine

![2g — Conflict Engine](diagrams/level2g.png)

---

### 2h — Requirements Engine

![2h — Requirements Engine](diagrams/level2h.png)

---

### 2i — Geo Conflict Engine

![2i — Geo Conflict Engine](diagrams/level2i.png)

---

### 2j — Pool Query DSL

![2j — Pool Query DSL](diagrams/level2j.png)

---

## Level 3 — Process Internals

Detailed decomposition of the highest-complexity processes within Level 2 subsystems: validation pipeline (3a), React subscription chain (3b), MonthView layout (3c), WeekView/DayView time grid (3d), initialization sequence (3e), undo/redo (3f), SyncQueue retry/conflict (3g).

---

### 3a — Engine Validation Pipeline (full decomposition of 2a validateConstraints)

![3a — Engine Validation Pipeline](diagrams/level3a.png)

---

### 3b — React Hook Subscription Chain

![3b — React Hook Subscription Chain](diagrams/level3b.png)

---

### 3c — MonthView Layout Algorithm

![3c — MonthView Layout Algorithm](diagrams/level3c.png)

---

### 3d — WeekView / DayView Time Grid

![3d — WeekView / DayView Time Grid](diagrams/level3d.png)

---

### 3e — Config / Engine Initialization Sequence

![3e — Config / Engine Initialization Sequence](diagrams/level3e.png)

---

### 3f — Undo / Redo Snapshot Mechanism

![3f — Undo / Redo Snapshot Mechanism](diagrams/level3f.png)

---

### 3g — SyncQueue: Optimistic Update, Retry, and Conflict Resolution

![3g — SyncQueue: Optimistic Update, Retry, and Conflict Resolution](diagrams/level3g.png)

---

### 3h — Reminders: Scheduling and Delivery

Data flow from `ReminderDef` on an event through `normalizeEvent`, `useReminders`, and out to the browser Notifications API or the host `onReminder` callback.

![3h — Reminders: Scheduling and Delivery](diagrams/level3h.png)

**Key invariants**
- Reminders with `delay < 1 s` at schedule time are skipped — avoids notification spam on page load for events that already started.
- `Notification.requestPermission()` is called once (guarded by a `useRef`) the first time a `'browser'` reminder is registered, not on every mount.
- All `setTimeout` handles are cleared in the effect cleanup, so navigating away or changing `visibleEvents` never leaves stale timers.

---

### 3i — Multi-Calendar Source Colors and Legend

Data flow from `useSourceStore` (localStorage) through `useSourceAggregator` (colour tagging) to rendered events and the `CalendarLegend` sidebar panel.

![3i — Multi-Calendar Source Colors and Legend](diagrams/level3i.png)

**Key invariants**
- `useSourceAggregator` builds two maps from `sourceStore.sources`: `labelToSourceId` (label → store UUID) and `sourceColorById` (store UUID → colour). ICS events resolve their `_sourceId` via `labelToSourceId` so store-managed feeds carry their actual UUID — not the mutable label string. Prop-level `icalFeeds` have no store entry and fall back to the label string as `_sourceId`.
- Toggling a source (`toggleSource`) flips `enabled` in the store; the next `useSourceAggregator` memo pass omits its events, which propagates through `useCalendarDataPipeline` to `visibleEvents` in a single render cycle.
- Changing a colour (`updateSource`) persists to `localStorage` immediately; the legend updates on the same render that triggers re-aggregation.
- Reminders are scheduled against `expandedEvents` (the pre-filter pool), not `visibleEvents`, so a reminder fires even when its event is currently hidden by an active filter condition.

---

### 3j — Offline Detection and Indicator

Data flow from the browser's `navigator.onLine` / `online` / `offline` events through `useNetworkStatus` to the `OfflineIndicator` banner.

![3j — Offline Detection and Indicator](diagrams/level3j.png)

**Key invariants**
- `isInitializing = true` is the SSR-safe default; the component renders nothing until after the first client-side effect fires, preventing a hydration mismatch.
- The banner is purely presentational — no write operations are blocked or queued by this component. It relies on the host's data adapter to handle retry transparently.
- Event listeners are removed on unmount so subscriptions don't accumulate across React strict-mode double-mounts.

### 3k — EventBus: Booking Lifecycle Pub-Sub

Data flow from a `CalendarEngine` approval-stage mutation through `channelForApprovalTransition`, `EventBus.emit`, and out to host subscribers (Slack, webhooks, email).

![3k — EventBus: Booking Lifecycle Pub-Sub](diagrams/level3k.png)

**Key invariants**
- `channelForApprovalTransition` returns `null` for same-stage transitions and non-lifecycle tiers (e.g. `pending_higher`); the engine emits at most one channel per `applyMutation` call.
- Handlers are dispatched via `queueMicrotask` — emission never re-enters the caller's call stack, satisfying the async-by-default contract expected by Slack/webhook integrations.
- The handler set is snapshotted at emit time: mid-dispatch unsubscribes do not skip siblings, and mid-dispatch subscribes do not receive the current emission.
- Errors in one handler are caught individually and routed to `onError`; sibling handlers always run.

---

### 3l — Booking Holds: Acquire / Conflict Check / Release Cycle

Data flow from `useBookingHold` (React hook) through `HoldRegistry.acquire`, conflict detection, and eventual `release` on unmount or submit.

![3l — Booking Holds: Acquire / Conflict Check / Release Cycle](diagrams/level3l.png)

**Key invariants**
- Holds are in-memory only (`byId` Map inside `createHoldRegistry`); they are not persisted to engine state or localStorage.
- Expiry is lazy: a hold past `expiresAt` is silently excluded on every read without mutating the Map. Call `prune()` to free memory.
- Re-acquisition by the **same** holder on an overlapping window replaces the existing entry (TTL refresh + window swap) rather than returning a conflict error.
- `findBlockingHold` is the integration point for the conflict engine's `hold-conflict` rule — it receives a snapshot of active holds and returns the first other-holder overlap.

---

### 3m — Saved Views: Serialization and Restore

Data flow from live filter state (with `Set` values) through `serializeFilters`, localStorage persistence, migration, and `deserializeFilters` back to live state.

![3m — Saved Views: Serialization and Restore](diagrams/level3m.png)

**Key invariants**
- `serializeFilters` uses a `JSON.stringify` replacer to convert every `Set` to `[...value]`; this makes the output safe for `localStorage` without requiring a schema.
- `deserializeFilters` restores `Set` for multi-select fields. When a `filterSchema` is provided the set of field keys comes from schema entries with `type === 'multi-select'`; otherwise it falls back to the hardcoded list `['categories', 'resources', 'sources']`.
- Storage is versioned (current: `v4`). `normalizeSavedView` fills missing fields added in later versions so older payloads load without errors.
- On first load with no `wc-saved-views-*` key, `migrateProfiles` automatically imports any legacy `wc-profiles-*` entries in a one-time migration.

---

### 3n — FocusChips: Chip Definition → Active State → visibleEvents Narrowing

Data flow from `FocusChipDef` array through the `FocusChips` component, atomic category-set toggling, and downstream filter narrowing in `useCalendarDataPipeline`.

![3n — FocusChips: Chip Definition → Active State → visibleEvents Narrowing](diagrams/level3n.png)

**Key invariants**
- A chip is "active" only when **every** category in its `categories` array is present in `activeCategories` (all-or-nothing, not partial).
- Toggling treats the chip as an **atomic unit**: clicking an inactive or partially-active chip adds all of its categories; clicking a fully-active chip removes all of them.
- When no chips are active (`activeCategories` is empty or undefined), all events pass the filter — normal calendar behavior is preserved.
- FocusChips operate exclusively on the `categories` filter key. They are composable with other active filters (date range, search, resource) because `applyFilters` evaluates all filter keys independently.

---

All six audit issues resolved across three sprints. See `CHANGELOG [0.7.0]` for details.

| # | Issue | Sprint | Status |
|---|-------|--------|--------|
| 1 | Duplicate recurrence expansion (`useOccurrences` deleted; engine read path only) | 3 | ✅ Done |
| 2 | `CalendarContext` typed as `any` → fully typed `CalendarContextValue` | 1 | ✅ Done |
| 3 | Dual state systems (`useCalendar` removed; engine is sole source of truth) | 3 | ✅ Done |
| 4 | Thin export wrapper (`exportToExcelLazy.ts` deleted; `excelExport.ts` exported directly) | 3 | ✅ Done |
| 5 | O(n) dependency lookups → `_dependenciesByFromEvent` / `_dependenciesByToEvent` indexes added | 1 | ✅ Done |
| 6 | `WorksCalendar.tsx` orchestration burden → extracted into `useCalendarEngine` hook | 2 | ✅ Done |
