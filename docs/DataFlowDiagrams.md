# Works Calendar — Data Flow Diagrams

Three levels of DFD covering the full library. Context (Level 0) → subsystems
(Level 1) → internals of the four most complex subsystems (Level 2).

> **Architecture status**: Diagrams below reflect the **target architecture**
> after the three-sprint refactor (see CHANGELOG `[Unreleased]`). The key
> structural changes from the audit:
> - `CalendarEngine` is now the **sole** source of truth for view, cursor, and
>   base filter state. The legacy `useCalendar` hook and its parallel state are gone.
> - `useCalendarEngine` owns engine setup, undo/redo, and all mutation handlers —
>   `WorksCalendar.tsx` is now a pure UI shell.
> - `useOccurrences` deleted; all views use the engine's `getOccurrencesInRange`
>   read path exclusively.
> - `CalendarContextValue` is fully typed — no more `[key: string]: any` escape hatch.

---

## Level 0 — Context Diagram

The library as a single process interacting with the world.

```
┌─────────────────┐        raw events / config        ┌───────────────────────────┐
│   Host App      │ ────────────────────────────────► │                           │
│  (React tree)   │                                    │     WORKS CALENDAR        │
│                 │ ◄──────────────────────────────── │      LIBRARY              │
│                 │   rendered views / callbacks       │                           │
└─────────────────┘                                    └──────────┬────────────────┘
                                                                  │
                    ┌─────────────────────────────────────────────┤
                    ▼                                             ▼
         ┌──────────────────┐                       ┌────────────────────────┐
         │  Remote Data     │                       │  Browser Storage       │
         │  Source          │                       │  (localStorage)        │
         │  (REST / WS /    │                       │  • config.json         │
         │   Supabase / ICS)│                       │  • resource pools      │
         └──────────────────┘                       │  • profile / theme     │
                                                    └────────────────────────┘
                    ▼
         ┌──────────────────┐
         │  External        │
         │  Channels        │
         │  (Slack / email  │
         │   / webhooks)    │
         └──────────────────┘
```

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

```
                         ┌──────────────────────────────────────────────────────────────┐
                         │                    WORKS CALENDAR LIBRARY                    │
                         │                                                              │
  rawEvents[]  ─────────►│  ┌──────────────┐    EngineEvents     ┌──────────────────┐  │
  config       ─────────►│  │  1. ADAPTER  │ ─────────────────► │   2. CALENDAR    │  │
  adapter      ─────────►│  │   LAYER      │                     │     ENGINE       │  │
                         │  │              │ ◄───────────────── │                  │  │
                         │  │ RestAdapter  │   CRUD operations   │  CalendarState   │  │
                         │  │ WsAdapter    │                     │  (events Map,    │  │
                         │  │ SupabaseAdpt │                     │   assignments,   │  │
                         │  │ ICSAdapter   │                     │   deps, pools,   │  │
                         │  │ SyncManager  │                     │   filter, view,  │  │
                         │  └──────────────┘                     │   cursor)        │  │
                         │         │                             └────────┬─────────┘  │
                         │         │ AdapterChange                        │             │
                         │         ▼                                      │ CalendarState│
                         │  ┌──────────────┐                              │             │
                         │  │  EventBus    │                              ▼             │
                         │  │  (lifecycle  │                     ┌──────────────────┐  │
                         │  │   channels)  │                     │  3. OCCURRENCE   │  │
                         │  └──────┬───────┘                     │     EXPANSION    │  │
                         │         │                             │                  │  │
                         │         │ booking.*/assignment.*      │  expandOccurrences│ │
                         │         ▼                             │  (rrule → dates) │  │
                         │  ┌──────────────┐                     │                  │  │
                         │  │  External    │                     └────────┬─────────┘  │
                         │  │  Channels    │                              │             │
                         │  │  Slack/email │                              │ occurrences[]│
                         │  │  /webhooks   │                              ▼             │
                         │  └──────────────┘                     ┌──────────────────┐  │
                         │                                        │  4. FILTER &     │  │
  filterSchema ─────────►│                                        │     GROUPING     │  │
  filterState  ─────────►│                                        │                  │  │
                         │                                        │  filterEngine    │  │
                         │                                        │  conditionEngine │  │
                         │                                        │  groupRows       │  │
                         │                                        │  sortEngine      │  │
                         │                                        └────────┬─────────┘  │
                         │                                                 │             │
                         │                                                 │ visibleEvents│
                         │                                                 ▼             │
                         │  ┌──────────────┐                     ┌──────────────────┐  │
                         │  │  6. WORKFLOW │                     │   5. VIEW LAYER  │  │
                         │  │  & APPROVALS │ ◄─── transitions ──│                  │  │
                         │  │              │ ──── emit events ──►│  MonthView       │  │
                         │  │  WorkflowDSL │                     │  WeekView / Day  │  │
                         │  │  transitions │                     │  ScheduleView    │  │
                         │  │  auditChain  │                     │  AgendaView      │  │
                         │  │  holdRegistry│                     │  MapView         │  │
                         │  └──────────────┘                     │  AssetsView      │  │
                         │                                        │  DispatchView    │  │
  config.json  ─────────►│  ┌──────────────┐                     └──────────────────┘  │
  localStorage ◄─────────│  │  7. CONFIG & │                              │             │
                         │  │  PERSISTENCE │                              │ user actions │
                         │  │              │                              ▼             │
                         │  │  parseConfig │                     ┌──────────────────┐  │
                         │  │  profileStore│                     │  UI / FORMS      │  │
                         │  │  poolStore   │                     │  EventForm       │  │
                         │  │  savedViews  │ ─ config/theme ────►│  FilterBar       │  │
                         │  │  themeSystem │◄─ settings writes ──│  WorkflowBuilder │  │
                         │  └──────────────┘                     │  ConfigPanel     │  │
                         │                                        │  ExportButtons   │  │
                         │                                        └──────────────────┘  │
                         └──────────────────────────────────────────────────────────────┘
```

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

---

## Level 2 — Subsystem Internals

Detailed flows for the four highest-complexity subsystems.

---

### 2a — Calendar Engine + Orchestration Hook (Subsystems 1 + 2, post-Sprint-2/3)

```
  EngineOperation
  (type, eventId,
   newStart/End,        ┌─────────────────────────────────────────────────┐
   resource, meta)      │             CALENDAR ENGINE                     │
  ──────────────────── ►│                                                 │
                        │  resolvePoolOnSubmit()                          │
                        │    If op.resourcePoolId is set:                 │
                        │      scan pool members, pick next via strategy  │
                        │      rewrite op with concrete resourceId        │
                        │      prepare poolUpdate (cursor advance)        │
                        │                       │                         │
                        │                       ▼                         │
                        │  validateOperation()  ──► validateConstraints() │
                        │      ├── validateEvent()      (hard: reject)    │
                        │      ├── validateOverlap()    (hard)            │
                        │      ├── validateDependencies() (hard)          │
                        │      ├── validateWorkingHours() (soft: warn)    │
                        │      └── validateEventConstraints() (configurable)│
                        │                       │                         │
                        │              hard violation?                    │
                        │               YES ──► OperationResult{rejected} │
                        │               NO      │                         │
                        │              soft violation without override?   │
                        │               YES ──► OperationResult{pending-  │
                        │                       confirmation}             │
                        │               NO      │                         │
                        │                       ▼                         │
                        │  resolveOperationScope()                        │
                        │    (this-only / this+future / all-in-series)   │
                        │                       │                         │
                        │                       ▼                         │
                        │  buildOperation() + applyOperation()            │
                        │    → EventChange[]                              │
                        │      {created | updated | deleted}              │
                        │                       │                         │
                        │                       ▼                         │
                        │  beginTransaction() / commitTransaction()       │
                        │    new Map<id, EngineEvent> (immutable swap)    │
                        │    atomic pool cursor advance                   │
                        │                       │                         │
                        │                       ▼                         │
                        │  _emitBookingLifecycle()                        │
                        │    EventBus.emit(booking.requested | approved   │
                        │               | denied | cancelled | completed) │
                        │                       │                         │
                        │                       ▼                         │
                        │  _notify() → all StateListeners                 │
                        └─────────────────────────────────────────────────┘
                                               │
                    ┌──────────────────────────┼─────────────────────────┐
                    ▼                          ▼                         ▼
            OperationResult            CalendarState              EventBus payload
            {status,                   (new events Map,           → adapters (Slack,
             violations,               pools, same cursor)          email, webhooks)
             changes}

  UndoRedoManager wraps the engine:
    snapshot() before each mutation → TransactionHandle
    rollbackTo(handle) on Ctrl+Z  → restores events + pools
    re-apply stack on Ctrl+Y
```

---

### 2b — Occurrence Expansion & Filtering (Subsystems 3 + 4)

```
  CalendarState.events   cursor / view type
  (Map<id, EngineEvent>) (month | week | day | schedule …)
         │                        │
         └──────────┬─────────────┘
                    ▼
       getOccurrencesInRange(rangeStart, rangeEnd)
         │
         ├── For each EngineEvent:
         │     Non-recurring → pass through if overlaps range
         │     Has rrule     → expandRRule(start, rrule, exdates, range±7d)
         │                     → Date[] → EngineOccurrence[]
         │                     max 500 occurrences per series (guard)
         │
         ▼
       EngineOccurrence[]   (id, seriesId, start, end, title, resource, …)
         │
         ▼
  ┌────────────────────────────────────────────────────────┐
  │                  FILTER PIPELINE                       │
  │                                                        │
  │  applyFilters(occurrences, filterState, schema)        │
  │                                                        │
  │  For each FilterField in schema:                       │
  │    text / search  → title + category + resource match  │
  │    date-range     → isWithinInterval check             │
  │    multi-select   → Set membership (categories,        │
  │                     resources, sources)                │
  │    custom         → field.predicate(item, value)       │
  │                                                        │
  │  conditionEngine (AdvancedFilterBuilder):              │
  │    evaluates AND/OR condition trees against event      │
  │    meta fields using operators (eq, gt, contains, …)  │
  │                                                        │
  └───────────────────────┬────────────────────────────────┘
                          │
                          ▼
                  filtered events[]
                          │
                          ▼
  ┌────────────────────────────────────────────────────────┐
  │               GROUPING + SORT PIPELINE                 │
  │                                                        │
  │  sortEvents(events, sortConfig)                        │
  │    → stable sort by field asc/desc                     │
  │                                                        │
  │  groupRows(events, groupByConfig)                      │
  │    buildFieldAccessor(field) → value extractor         │
  │    group by 1–3 levels (category, resource, date, …)  │
  │    → GroupRow[] with children and header labels        │
  │                                                        │
  └───────────────────────┬────────────────────────────────┘
                          │
                          ▼
              grouped / sorted visibleEvents[]
              passed to active View component
```

---

### 2c — Adapter Layer & Sync (Subsystem 1)

```
  CalendarAdapter (interface)
  ┌────────────────────────────────────────────────────────────────┐
  │                                                                │
  │  Implementations:                                              │
  │  ┌────────────┐  ┌────────────┐  ┌───────────┐  ┌──────────┐│
  │  │RestAdapter │  │WsAdapter   │  │Supabase   │  │ICSAdapter││
  │  │loadRange() │  │subscribe() │  │Adapter    │  │importFeed││
  │  │createEvent │  │(WebSocket) │  │(realtime  │  │parseICS()││
  │  │updateEvent │  │            │  │ channel)  │  │          ││
  │  │deleteEvent │  │            │  │           │  │          ││
  │  └────────────┘  └────────────┘  └───────────┘  └──────────┘│
  └──────────────────────────┬─────────────────────────────────────┘
                             │ CalendarEventV1[]
                             ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                      SYNC MANAGER                            │
  │                                                              │
  │  loadRange(start, end)                                       │
  │    → adapter.loadRange() → merge into events Map            │
  │                                                              │
  │  createEvent(ev) / updateEvent(id, patch) / deleteEvent(id) │
  │    1. Apply optimistically to local events Map               │
  │    2. Enqueue to SyncQueue (status: 'pending')               │
  │    3. Notify subscribers                                     │
  │    4. Call adapter in background                             │
  │       ✓ success → mark 'synced', replace with server copy   │
  │       ✗ conflict → conflictResolver(local, server)          │
  │          • 'server-wins' | 'client-wins' | 'latest-wins'    │
  │          • 'manual' → onConflict callback (UI modal)         │
  │       ✗ error → mark 'error', call onError, keep rollback   │
  │                  retry up to maxRetries with exp. backoff     │
  │                                                              │
  │  connectLive()                                               │
  │    → adapter.subscribe(AdapterChangeCallback)                │
  │    → insert/update/delete patched into local Map             │
  │    → reload replaces full Map                                │
  │                                                              │
  └──────────────────────────┬───────────────────────────────────┘
                             │ SyncState
                             │ { events: Map, syncStatuses: Map,
                             │   isSyncing, conflicts }
                             ▼
                     useSyncedCalendar hook
                     (React wrapper around SyncManager)
```

---

### 2d — Workflow & Approval System (Subsystem 6)

```
  User action         Workflow DSL        ApprovalStage
  (approve / deny /   (Workflow JSON)     (from event.meta)
   cancel / timeout)
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                  transitionApproval()                       │
  │                                                             │
  │  1. legalActionsFrom(currentStage) — guard illegal jumps    │
  │     (e.g. finalized → requested is blocked)                 │
  │                                                             │
  │  2. If workflow supplied:                                   │
  │     advance(workflowInstance, action) →                     │
  │       • auto-walk condition + notify nodes                  │
  │       • stop at approval node (→ awaiting)                  │
  │         or terminal node (→ completed / denied)             │
  │       • parallel branches: per-branch approval tracking     │
  │         join releases on quorum (requireAll / requireAny /  │
  │         requireCount)                                       │
  │       → WorkflowInstance (updated)                          │
  │       → WorkflowEmitEvent[] (node_entered, action_taken,   │
  │                               outcome_set, timer_scheduled) │
  │                                                             │
  │  3. appendAuditEntry(stage, action, actor, reason)          │
  │     → SHA-256 hash chain (tamper-evident audit trail)       │
  │                                                             │
  │  4. Return TransitionResult { ok, stage, workflowInstance } │
  └────────────────────┬────────────────────────────────────────┘
                       │
         ┌─────────────┼──────────────────┐
         ▼             ▼                  ▼
  Updated          WorkflowInstance    WorkflowEmitEvent[]
  ApprovalStage    (host persists       → EventBus channels
  (host writes     to event.meta)         booking.approved
   back to event)                         booking.denied
                                          booking.cancelled
                                          → channel adapters
                                            (Slack, email,
                                             webhooks)

  useWorkflowTicker (React hook):
    setInterval → tick(instance, workflow, now)
    → auto-fires 'timeout' actions when node deadline passed
    → calls onTimeout callback for host to persist result

  HoldRegistry (booking holds):
    acquireHold(resourceId, window, holderId, ttl)
      → blocks overlapping booking attempts with soft violation
    releaseHold(holdId) → on form close / submit
    findBlockingHold() → used by conflictEngine
```

---

---

## Sprint Implementation Status

All six audit issues resolved across three sprints. See `CHANGELOG [Unreleased]` for details.

| # | Issue | Sprint | Status |
|---|-------|--------|--------|
| 1 | Duplicate recurrence expansion (`useOccurrences` deleted; engine read path only) | 3 | ✅ Done |
| 2 | `CalendarContext` typed as `any` → fully typed `CalendarContextValue` | 1 | ✅ Done |
| 3 | Dual state systems (`useCalendar` removed; engine is sole source of truth) | 3 | ✅ Done |
| 4 | Thin export wrapper (`exportToExcelLazy.ts` deleted; `excelExport.ts` exported directly) | 3 | ✅ Done |
| 5 | O(n) dependency lookups → `_dependenciesByFromEvent` / `_dependenciesByToEvent` indexes added | 1 | ✅ Done |
| 6 | `WorksCalendar.tsx` orchestration burden → extracted into `useCalendarEngine` hook | 2 | ✅ Done |
