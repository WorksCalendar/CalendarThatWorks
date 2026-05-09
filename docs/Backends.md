# Backend Adapters

WorksCalendar ships a `CalendarAdapter` interface and a growing set of
concrete implementations. Pick the one that matches your backend and pass it
to `useSyncedCalendar` — the hook handles optimistic updates, conflict
resolution, retry logic, and (optionally) live subscriptions.

```ts
import { useSyncedCalendar } from 'works-calendar';

const { events, createEvent, updateEvent, deleteEvent } = useSyncedCalendar({
  adapter,
  start,
  end,
  live: true, // connect realtime subscription on mount
});
```

---

## Adapters at a glance

| Adapter | Package | Realtime | Notes |
|---|---|---|---|
| `RestAdapter` | built-in | polling | Any JSON REST API |
| `SupabaseAdapter` | built-in | Supabase Realtime | Postgres via Supabase |
| `FirebaseAdapter` | built-in | Firestore `onSnapshot` | v8 + v9 modular API |
| `PocketBaseAdapter` | built-in | PocketBase SSE | Self-hosted PocketBase |
| `ICSAdapter` | built-in | polling | Read-only iCal feeds |
| `WebSocketAdapter` | built-in | WebSocket | Custom WS server |

All adapters are duck-typed — they never hard-import their backend SDK, so
your bundle only includes the SDKs you actually install.

---

## RestAdapter

Points at any JSON endpoint that speaks the expected shape. The simplest
starting point — also the right client-side counterpart for the
[Next.js handler](#nextjs-prisma--drizzle).

```ts
import { RestAdapter } from 'works-calendar/api/v1/adapters';

const adapter = new RestAdapter({
  baseUrl: '/api/events',
  headers: { Authorization: `Bearer ${token}` },

  // map your API shape → CalendarEventV1
  fromResponse: row => ({
    id:    String(row.event_id),
    title: row.name as string,
    start: new Date(row.starts_at as string),
    end:   new Date(row.ends_at   as string),
  }),

  // map CalendarEventV1 → your API body
  toRequest: ev => ({
    name:      ev.title,
    starts_at: (ev.start as Date).toISOString(),
    ends_at:   (ev.end   as Date).toISOString(),
  }),
});
```

`subscribe()` uses polling (default 60 s). Pass `pollInterval: null` to
disable.

---

## SupabaseAdapter

Reads and writes via the Supabase Data API and subscribes to
`postgres_changes` realtime events.

```ts
import { createClient } from '@supabase/supabase-js';
import { SupabaseAdapter } from 'works-calendar/api/v1/adapters';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const adapter = new SupabaseAdapter({
  client: supabase,
  table:  'calendar_events',
  filter: 'org_id=eq.acme',   // optional PostgREST filter
  startCol: 'starts_at',
  endCol:   'ends_at',
  fromRow: row => ({
    id:    String(row.id),
    title: row.name as string,
    start: new Date(row.starts_at as string),
    end:   new Date(row.ends_at   as string),
  }),
  toRow: ev => ({
    name:      ev.title,
    starts_at: (ev.start as Date).toISOString(),
    ends_at:   (ev.end   as Date).toISOString(),
    org_id:    'acme',
  }),
});
```

---

## FirebaseAdapter

Queries Firestore and subscribes via `onSnapshot` for real-time updates.
Supports both the v8 namespaced API and the v9 modular API.

**v9 modular SDK (recommended)**

```ts
import { initializeApp }                          from 'firebase/app';
import { getFirestore, collection, query, where,
         orderBy, getDocs, addDoc, updateDoc,
         deleteDoc, doc, onSnapshot }             from 'firebase/firestore';
import { FirebaseAdapter } from 'works-calendar/api/v1/adapters';

const app = initializeApp({ projectId: 'my-project', /* ... */ });
const db  = getFirestore(app);

const adapter = new FirebaseAdapter({
  db,
  collection: 'calendarEvents',
  startField: 'startsAt',
  endField:   'endsAt',
  // extra constraints applied to every query, e.g. tenant scoping
  extraWhere: [['orgId', '==', 'acme']],
  fromDoc: doc => ({
    id:    doc.id as string,
    title: doc.name as string,
    start: (doc.startsAt as { toDate(): Date }).toDate(),
    end:   (doc.endsAt   as { toDate(): Date }).toDate(),
  }),
  toDoc: ev => ({
    name:    ev.title,
    startsAt: ev.start,
    endsAt:   ev.end,
    orgId:   'acme',
  }),
  adapterFns: { collection, query, where, orderBy,
                getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot },
});
```

**v8 namespaced SDK**

Omit `adapterFns` — the adapter falls back to `db.collection(...).where(...)`:

```ts
import firebase from 'firebase/app';
import 'firebase/firestore';

const db = firebase.firestore();

const adapter = new FirebaseAdapter({ db, collection: 'events' });
```

---

## PocketBaseAdapter

Connects to a [PocketBase](https://pocketbase.io) instance using the
official JS SDK. Subscribes to live changes via Server-Sent Events.

```ts
import PocketBase from 'pocketbase';
import { PocketBaseAdapter } from 'works-calendar/api/v1/adapters';

const pb = new PocketBase('https://myapp.pockethost.io');
await pb.collection('users').authWithPassword(email, password);

const adapter = new PocketBaseAdapter({
  pb,
  collection: 'events',
  startField: 'starts_at',
  endField:   'ends_at',
  extraFilter: 'org = "acme"',   // optional, ANDed with date range
  fromRecord: r => ({
    id:    r.id,
    title: r.name as string,
    start: new Date(r.starts_at as string),
    end:   new Date(r.ends_at   as string),
  }),
  toRecord: ev => ({
    name:      ev.title,
    starts_at: (ev.start as Date).toISOString(),
    ends_at:   (ev.end   as Date).toISOString(),
    org:       'acme',
  }),
});
```

---

## Next.js — Prisma / Drizzle

Use `createNextHandler` on the server to expose a REST endpoint, then point
`RestAdapter` at it on the client. This works with any server-side ORM.

**`app/api/events/[...slug]/route.ts`**

```ts
import { createNextHandler } from 'works-calendar/api/v1/server';
import { getServerSession }  from 'next-auth';
import { prisma }            from '@/lib/prisma';

const { GET, POST, PATCH, DELETE } = createNextHandler({

  auth: async (req) => {
    const session = await getServerSession();
    if (!session) throw new Error('Unauthorized');
  },

  async loadRange(start, end) {
    return prisma.calendarEvent.findMany({
      where: { start: { gte: start }, end: { lt: end } },
      orderBy: { start: 'asc' },
    });
  },

  async createEvent(event) {
    return prisma.calendarEvent.create({ data: event });
  },

  async updateEvent(id, patch) {
    return prisma.calendarEvent.update({ where: { id }, data: patch });
  },

  async deleteEvent(id) {
    await prisma.calendarEvent.delete({ where: { id } });
  },
});

export { GET, POST, PATCH, DELETE };
```

**Client**

```ts
import { RestAdapter } from 'works-calendar/api/v1/adapters';

const adapter = new RestAdapter({ baseUrl: '/api/events' });
```

**With Drizzle ORM**

```ts
import { createNextHandler } from 'works-calendar/api/v1/server';
import { db }                from '@/lib/db';
import { events }            from '@/lib/schema';
import { and, gte, lt, eq } from 'drizzle-orm';

const { GET, POST, PATCH, DELETE } = createNextHandler({
  async loadRange(start, end) {
    return db.select().from(events).where(
      and(gte(events.start, start), lt(events.start, end))
    );
  },
  async createEvent(event) {
    const [row] = await db.insert(events).values(event).returning();
    return row;
  },
  async updateEvent(id, patch) {
    const [row] = await db.update(events)
      .set(patch).where(eq(events.id, id)).returning();
    return row;
  },
  async deleteEvent(id) {
    await db.delete(events).where(eq(events.id, id));
  },
});

export { GET, POST, PATCH, DELETE };
```

---

## Writing a custom adapter

Implement the `CalendarAdapter` interface — only `loadRange` is required:

```ts
import type { CalendarAdapter, AdapterChangeCallback } from 'works-calendar/api/v1/adapters';
import type { CalendarEventV1 } from 'works-calendar/api/v1';

export class MyAdapter implements CalendarAdapter {
  async loadRange(start: Date, end: Date, signal?: AbortSignal): Promise<CalendarEventV1[]> {
    const res = await fetch(`/my-api?from=${start.toISOString()}&to=${end.toISOString()}`, { signal });
    return res.json();
  }

  async createEvent(event: CalendarEventV1): Promise<CalendarEventV1> { /* ... */ }
  async updateEvent(id: string, patch: Partial<CalendarEventV1>): Promise<CalendarEventV1> { /* ... */ }
  async deleteEvent(id: string): Promise<void> { /* ... */ }

  // optional — emit insert/update/delete as they happen
  subscribe(callback: AdapterChangeCallback): () => void {
    const es = new EventSource('/my-api/stream');
    es.onmessage = e => callback(JSON.parse(e.data));
    return () => es.close();
  }
}
```

See [`CalendarAdapter.ts`](../src/api/v1/adapters/CalendarAdapter.ts) for the
full interface including optional methods for schedule templates, booking
holds, and lifecycle event bus integration.
