# Resource pools

A `ResourcePool` lets bookings target **"any available member"** instead
of a specific asset or employee. When an event carries a
`resourcePoolId`, the engine resolves it to a concrete `resource` at
submit time using a configurable strategy.

Use pools when the customer doesn't care who runs the job — just that
it gets run:

- "Any West-region aircraft" for charter dispatch
- "Any available driver" for fleet routing
- "Any hot-desk in the SF office" for coworking

## Data shape

```ts
export interface ResourcePool {
  id:         string;
  name:       string;
  memberIds:  string[];                 // ids from the asset/employee registry
  strategy:   'first-available' | 'least-loaded' | 'round-robin';
  rrCursor?:  number;                   // round-robin only; engine-owned
  disabled?:  boolean;                  // history stays; new bookings rejected
}
```

Members are referenced by registry id, not by label. Pools that list
unknown ids still work — the resolver simply skips them.

## Wiring

Pass the pool list and an `onPoolsChange` callback to `WorksCalendar`.
Persist the pools wherever you keep calendar config (`localStorage`, a
JSON file in S3, a settings table). The round-robin cursor advances
inside the engine and echoes back through `onPoolsChange` on every
commit so the rotation survives a reload.

```tsx
import { WorksCalendar } from 'works-calendar';
import { loadPools, savePools } from 'works-calendar';

const CALENDAR_ID = 'fleet-ops';

function FleetCalendar() {
  const [pools, setPools] = useState(() => {
    const persisted = loadPools(CALENDAR_ID);
    return persisted.length > 0 ? persisted : DEFAULT_POOLS;
  });

  const handlePoolsChange = (next) => {
    setPools(next);
    savePools(CALENDAR_ID, next);
  };

  return (
    <WorksCalendar
      assets={assets}
      pools={pools}
      onPoolsChange={handlePoolsChange}
      events={events}
      onEventSave={onEventSave}
    />
  );
}

const DEFAULT_POOLS = [
  {
    id:        'fleet-west',
    name:      'West Fleet',
    memberIds: ['N121AB', 'N505CD'],
    strategy:  'round-robin',
  },
  {
    id:        'fleet-central',
    name:      'Central Fleet',
    memberIds: ['N88QR', 'N733XY'],
    strategy:  'first-available',
  },
];
```

The demo app at `demo/App.tsx` wires the exact snippet above against
`localStorage`; use it as a reference implementation.

## Booking flow

1. The Assets view renders each pool as a virtual row at the top, with
   a `POOL` chip and a hover tooltip listing its members.
2. Clicking an empty day cell on a pool row opens the EventForm with
   `resourcePoolId` seeded; the form doesn't expose the field, so the
   user fills in a title as usual and saves.
3. On submit, the engine:
   - picks a concrete member via the pool's strategy,
   - runs the normal conflict/overlap validators against the resolved
     member,
   - commits the event with `resource = <member>` and
     `meta.resolvedFromPoolId = <pool id>`.
4. `onEventSave` fires with the resolved payload, so the host sees the
   concrete member, not the pool id.

The pool row aggregates member bookings — any event on any member
appears on the pool row. Click a "busy" cell anyway; the resolver will
still find a free member if one exists.

## Strategies

| Strategy          | Picks                                                    |
|-------------------|----------------------------------------------------------|
| `first-available` | First member, in declared order, with no hard conflict   |
| `least-loaded`    | Member with the lowest `workloadForResource()` in window |
| `round-robin`     | Next member after the stored cursor, skipping conflicts  |

`round-robin` persists its cursor (`rrCursor`) on the pool itself. The
engine advances the cursor atomically with the booking commit and
includes the updated pool in the next `onPoolsChange`.

If every member is in hard conflict, the submit is rejected with a
`NO_AVAILABLE_MEMBER` violation — nothing is written and no member
rotates. An unknown pool id rejects with `POOL_UNKNOWN`; a disabled
pool rejects with `POOL_DISABLED`; a pool with zero members rejects
with `POOL_EMPTY`. Every rejection carries `details.evaluated`, the
ordered list of members the resolver actually attempted (empty for
`POOL_DISABLED` / `POOL_EMPTY`, populated for `NO_AVAILABLE_MEMBER`).

## Sharing members across pools

Two pools may list the same member id. Pools are independent: the
resolver for pool A does not know or care that member `M` also belongs
to pool B. If your host submits two pool-backed bookings in parallel
against overlapping time windows and both happen to resolve to `M`,
the normal `resource-overlap` rule will reject the second submit —
but only when the second submit actually runs. There is **no
cross-pool mutual exclusion or holding phase**; if you need one, do
it at your host layer (queue submits, or wrap them in an optimistic
transaction).

## Disabled pools

Flip `disabled: true` to retire a pool. History stays searchable but:

- the Assets view stops rendering the pool row (no more drafts get
  started against it),
- API submits that still reference the pool id are rejected with
  `POOL_DISABLED`.

Re-enable by clearing the flag.

## Audit trail

Every pool-resolved event carries `meta.resolvedFromPoolId` so the
audit lineage is never lost. The Assets view surfaces this on the
event pill's hover tooltip, including the pool name when it can be
looked up, so an operator scanning utilization can see at a glance
which bookings originated from a pool.

## Storage helper

`works-calendar` ships a tiny `localStorage` adapter that
round-trips the pool list. It's deliberately small — swap it out for
your own adapter if you need server-backed persistence.

```ts
import { loadPools, savePools, clearPools } from 'works-calendar';

savePools('calendar-1', pools);
const restored = loadPools('calendar-1');
clearPools('calendar-1');
```

Keys are namespaced by calendar id, so multiple calendars on the same
origin don't collide.
