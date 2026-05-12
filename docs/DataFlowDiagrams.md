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
- Source colours are keyed by `label` for ICS feeds (since ICS events only carry the feed label, not an internal ID) and by direct `source.color` for CSV sources.
- Toggling a source (`toggleSource`) flips `enabled` in the store; the next `useSourceAggregator` memo pass omits its events, which propagates through `useCalendarDataPipeline` to `visibleEvents` in a single render cycle.
- Changing a colour (`updateSource`) persists to `localStorage` immediately; the legend updates on the same render that triggers re-aggregation.

---

### 3j — Offline Detection and Indicator

Data flow from the browser's `navigator.onLine` / `online` / `offline` events through `useNetworkStatus` to the `OfflineIndicator` banner.

![3j — Offline Detection and Indicator](diagrams/level3j.png)

**Key invariants**
- `isInitializing = true` is the SSR-safe default; the component renders nothing until after the first client-side effect fires, preventing a hydration mismatch.
- The banner is purely presentational — no write operations are blocked or queued by this component. It relies on the host's data adapter to handle retry transparently.
- Event listeners are removed on unmount so subscriptions don't accumulate across React strict-mode double-mounts.

All six audit issues resolved across three sprints. See `CHANGELOG [0.7.0]` for details.

| # | Issue | Sprint | Status |
|---|-------|--------|--------|
| 1 | Duplicate recurrence expansion (`useOccurrences` deleted; engine read path only) | 3 | ✅ Done |
| 2 | `CalendarContext` typed as `any` → fully typed `CalendarContextValue` | 1 | ✅ Done |
| 3 | Dual state systems (`useCalendar` removed; engine is sole source of truth) | 3 | ✅ Done |
| 4 | Thin export wrapper (`exportToExcelLazy.ts` deleted; `excelExport.ts` exported directly) | 3 | ✅ Done |
| 5 | O(n) dependency lookups → `_dependenciesByFromEvent` / `_dependenciesByToEvent` indexes added | 1 | ✅ Done |
| 6 | `WorksCalendar.tsx` orchestration burden → extracted into `useCalendarEngine` hook | 2 | ✅ Done |
