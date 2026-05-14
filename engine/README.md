# works-calendar-engine

Rule-based scheduling validation for any calendar UI.

```ts
import { CalendarEngine, evaluateConflicts } from 'works-calendar-engine';

const engine = new CalendarEngine({ events: myEvents });
const conflicts = evaluateConflicts(candidate, allEvents, rules);
```

Works with React, Vue, Svelte, or vanilla JS. Works on the server too.

## Why

FullCalendar renders. This validates. Plug it under any calendar UI to get:

- 8 built-in conflict rules (resource overlap, capacity, business hours, min rest, ...)
- Schedule-kind domain model (shift, on-call, open shift, covering)
- Typed operations with begin/commit/rollback transactions
- Undo/redo with full state snapshots
- Pub/sub lifecycle events (booking.requested, .approved, .denied, ...)
- Framework-agnostic — pure TypeScript, only depends on date-fns

## Install

```bash
npm install works-calendar-engine date-fns
```

## Examples

- [`examples/react-basic`](./examples/react-basic) — month view + conflict badges
- [`examples/node-server`](./examples/node-server) — Express validates bookings before DB write
- [`examples/fullcalendar-bridge`](./examples/fullcalendar-bridge) — add intelligence under FullCalendar

## License

MIT
