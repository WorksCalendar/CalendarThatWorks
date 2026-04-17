# Grouping & Sort API

Reference for the grouping, sorting, and group-change DnD surface added in
v0.3 ("infinite grouping").  Examples live in
[`examples/09-Grouping.jsx`](../examples/09-Grouping.jsx) and
[`examples/10-DragAndDrop.jsx`](../examples/10-DragAndDrop.jsx).

---

## Props — `<WorksCalendar>`

| Prop                 | Type                                         | Default | Notes                                                                                              |
| -------------------- | -------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `groupBy`            | `string \| string[] \| GroupConfig[]`        | —       | One, two, or three nesting levels. String shorthand reads `event[field] ?? event.meta[field]`.     |
| `sort`               | `SortConfig \| SortConfig[]`                 | —       | Ordered tiebreakers. Applied inside each leaf group.                                               |
| `showAllGroups`      | `boolean`                                    | `false` | Surface empty groups and cross-group copies (an event whose field value matches multiple groups).  |
| `onEventGroupChange` | `(event, patch) => void`                     | —       | Fires on cross-group drag-drop. `patch` is a partial event to merge: e.g. `{ resource: 'bob' }`.   |

All four flow through the engine validation + undo pipeline, and serialize
into saved views (schema v3).

---

## `GroupByInput`

```ts
type GroupByInput =
  | string             // "role"
  | string[]           // ["role", "shift"]
  | GroupConfig[];     // [{ field: "role", showEmpty: true, getLabel: ... }]
```

Arrays define nesting depth (top → bottom). Mixing string and `GroupConfig`
in one array is not supported — pick one form per invocation.

### `GroupConfig`

```ts
type GroupConfig = {
  field: string;
  label?: string;
  showEmpty?: boolean;
  getKey?:   (event: NormalizedEvent) => string | null;
  getLabel?: (key: string, events: NormalizedEvent[]) => string;
};
```

| Field       | Purpose                                                                            |
| ----------- | ---------------------------------------------------------------------------------- |
| `field`     | Default key + value source. Reads `event[field]`, then `event.meta[field]`.        |
| `label`     | Display name for this **grouping dimension** (shown in UI headers, a11y labels).   |
| `showEmpty` | When true, groups with 0 events after filtering are still rendered (as 0-count).   |
| `getKey`    | Custom key extractor.  Return `null` or `''` to place the event in `(Ungrouped)`. |
| `getLabel`  | Custom display label for a resolved key — e.g. translate an id to a human name.    |

### `GroupResult`

Returned from `useGrouping` / `groupRows`:

```ts
type GroupResult = {
  key:      string;                 // raw value
  label:    string;                 // display label
  field:    string;                 // dimension
  depth:    number;                 // 0 = top-level
  events:   NormalizedEvent[];      // non-empty only on leaves
  children: GroupResult[];          // non-empty only on branches
};
```

---

## `SortConfig`

```ts
type SortConfig = {
  field:      string;
  direction:  'asc' | 'desc';
  getValue?:  (event: NormalizedEvent) => unknown;
};
```

- Multiple configs are applied as tiebreakers in array order.
- `Date`, `number`, `boolean` are compared natively; everything else falls back
  to `localeCompare` with `numeric: true`.
- `null` / `undefined` always sort last regardless of direction.

---

## Drag-and-drop between groups

`onEventGroupChange(event, patch)` fires when a user drags an event into a
different group (AgendaView) or a different resource row (TimelineView).

| View             | Target              | Emitted patch                                                                 |
| ---------------- | ------------------- | ----------------------------------------------------------------------------- |
| AgendaView       | Leaf group          | One field per `groupBy` dimension.  E.g. `{ role: 'Doctor', shift: 'Night' }`. |
| TimelineView     | Resource row        | `{ resource: <employeeId or null> }`.  `null` for the `(Unassigned)` row.     |

Same-group / same-row drops are short-circuited — the callback does **not**
fire.

Behaviour:

- Drops flow through the `CalendarEngine` as a `group-change` op, so you can
  register custom validators via `OperationContext.groupChangeValidators`
  (see below) to accept, soft-warn, or hard-reject reassignments with the
  standard validation protocol.
- When `onEventGroupChange` is absent, events are **not** draggable.  This
  keeps the DnD surface opt-in and backwards-compatible.

### `GroupChangeRule`

```ts
type GroupChangeRule = (
  change: { event: EngineEvent; patch: Readonly<Record<string, unknown>> },
  ctx:    OperationContext,
) => Violation | null;

type Violation = {
  rule:     string;
  severity: 'soft' | 'hard';
  message:  string;
};
```

Register via the engine context:

```ts
const engine = createCalendarEngine({
  groupChangeValidators: [
    ({ event, patch }) => {
      if (patch.resource && event.category === 'on-call' && patch.resource !== 'alice') {
        return { rule: 'on-call-owner', severity: 'hard', message: 'Only Alice can own on-call shifts.' };
      }
      return null;
    },
  ],
});
```

The returned `OperationResult` carries one of:

| Status                    | Meaning                                              |
| ------------------------- | ---------------------------------------------------- |
| `accepted`                | No violations. Change applied.                       |
| `accepted-with-warnings`  | Soft violations; user confirmed override.            |
| `pending-confirmation`    | Soft violations; needs `overrideSoftViolations`.     |
| `rejected`                | Hard violation. No changes emitted.                  |

---

## Saved views

Saved views persist `groupBy`, `sort`, and `showAllGroups` alongside the
filter state (schema v3).  The `useSavedViews` hook round-trips these through
JSON — see [`v0.2-to-v0.3-MIGRATION.md`](./v0.2-to-v0.3-MIGRATION.md) for the
schema change.

---

## Performance

`groupRows()` is O(n · depth) in event count.  Baseline on a 2020-era laptop
at Node 20, measured via `scripts/perf-benchmark.mjs`:

| Events | Depth   | p95    |
| ------ | ------- | ------ |
| 500    | 1-level | ~0.3ms |
| 1000   | 2-level | ~0.2ms |
| 1000   | 3-level | ~0.3ms |
| 2000   | 3-level | ~0.4ms |

Budget: p95 < 100ms at 1000ev × 3-level.  Regressions are caught by running
`node scripts/perf-benchmark.mjs` against the committed baseline in
`docs/perf-baselines.json`.

---

## Low-level exports

For apps that want to drive grouping outside of `<WorksCalendar>`:

```ts
import {
  groupRows,             // pure groupRows({ rows, groupBy, fieldAccessor, ... })
  buildFieldAccessor,    // string | string[] → accessor fn(s)
  useGrouping,           // React hook: flatRows, collapsedGroups, toggleGroup
} from 'works-calendar';
```

See `src/grouping/` and `src/hooks/useGrouping.{js,ts}` for full signatures.
