# WorksCalendar

**Embeddable scheduling engine for teams, assets, and operations.** Drop it into a React app and get a working calendar, dispatch board, request queue, and approval pipeline — all driven by one config object.

**Website:** [workscalendar.com](https://workscalendar.com) · **Repository:** [github.com/workscalendar/calendarthatworks](https://github.com/workscalendar/calendarthatworks)

WorksCalendar provides the building blocks for advanced scheduling. Applications are expected to configure and extend these systems to fit their workflow.

## Core features (fully working)

- Multiple calendar modes: month, week, day, agenda, schedule, timeline
- Event lifecycle states (draft → pending → approved → scheduled → completed) surfaced everywhere
- Conflict engine with hard-block / soft-warning modes, live inline feedback in the editor, and conflict highlights on the calendar
- Request queue with approve / deny / finalize / revoke actions wired to a tamper-evident audit chain
- Dispatch readiness board with per-row "Why?" breakdown — driver / pilot / pool shortfalls explained in plain English
- Schema-driven filtering, saved views, themeable UI with packaged themes
- Data adapter pattern for backend-agnostic integrations
- **Written in strict TypeScript**; ships with generated `.d.ts` so consumer types stay in lockstep with the implementation

## Extensible systems (configurable)

- Approval workflow DSL — multi-tier approvals, SLA timers + escalation, parallel branches with quorum joins (`requireAll` / `requireAny` / `requireN`), and pluggable notification channels (Slack, email, webhook, or your own adapter)
- Resource pools with a query DSL (capability + distance filters), pool resolution strategies, and per-pool readiness evaluation
- Requirement templates — declare per-event-type role / pool needs and let `evaluateRequirements` gate the booking
- Custom resource types, roles, labels, and capability schemas

## Profiles

WorksCalendar ships starter profiles so the same engine fits multiple industries via configuration:

| Profile             | Resource label | Event label | Default roles                                                |
| ------------------- | -------------- | ----------- | ------------------------------------------------------------ |
| `air_medical`       | Aircraft       | Mission     | Pilot in Command, Flight Paramedic, Flight Nurse, Dispatcher |
| `aviation`          | Aircraft       | Flight      | Pilot in Command, Second in Command, Dispatcher              |
| `trucking`          | Truck          | Load        | Driver, Dispatcher                                           |
| `equipment_rental`  | Equipment      | Rental      | Yard Attendant, Delivery Driver, Dispatcher                  |
| `scheduling`        | Room           | Booking     | Organizer, Attendee                                          |
| `custom`            | Resource       | Event       | (none)                                                       |

Apply a profile via the setup wizard's "What are you scheduling?" step or programmatically:

```ts
import { applyProfilePreset } from 'works-calendar';

const config = applyProfilePreset('air_medical');
// config.labels.resource === 'Aircraft'
// config.roles → [pilot-in-command, flight-paramedic, flight-nurse, …]
```

Switching profiles changes terminology and defaults without changing logic — the conflict engine, requirement evaluator, and approval reducer all read off the same config.

## New here? Start with the [Setup guide](./docs/Setup.md)

Plain-language walkthrough from `npm install` to a working, connected calendar — pick only the steps you need.

## Installation

```bash
npm install works-calendar
```

## Quick start

```jsx
import { WorksCalendar } from 'works-calendar';
import 'works-calendar/styles';
import 'works-calendar/styles/ocean';

export function App({ events, employees }) {
  return (
    <WorksCalendar
      events={events}
      employees={employees}
      initialView="schedule"
      theme="ocean"
    />
  );
}
```

## Examples

Run the local example suite:

```bash
npm install
npm run examples
```

Example catalogs:

- [Examples index](./examples/README.md)
- [Workflow mapping](./examples/WORKFLOWS.md)

## Documentation

- [Setup guide](./docs/Setup.md) — start here
- [Docs index](./docs/README.md)
- [Schedule workflow guide](./docs/ScheduleWorkflow.md)
- [Approval workflow DSL](./docs/Workflow.md)
- [Filtering system](./docs/Filtering.md)
- [Data adapter guide](./docs/DataAdapter.md)
- [Google Calendar setup](./docs/GoogleCalendarSetup.md)
- [Microsoft 365 setup](./docs/Microsoft365Setup.md)
- [Contributing](./docs/Contributing.md)

## Theming

Base styles:

```jsx
import 'works-calendar/styles';
```

Optional theme styles:

```jsx
import 'works-calendar/styles/ocean';
```

Included packaged themes: `aviation`, `soft`, `minimal`, `corporate`, `forest`, `ocean`.

## Customizing the chrome

The calendar's left icon rail and right panel are two slots embedders can
extend without forking. The stock chrome (saved-views, focus filters,
settings, region map, crew on shift) keeps stable positions; your
content lands after the built-ins.

```tsx
import {
  WorksCalendar,
  RightPanelSection,
  type LeftRailAction,
} from 'works-calendar';
import { Bell, Download } from 'lucide-react';

const railExtras: LeftRailAction[] = [
  {
    id: 'export',
    label: 'Export',
    hint: 'Download visible events as CSV',
    icon: <Download size={18} aria-hidden="true" />,
    onClick: () => exportCsv(),
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: <Bell size={18} aria-hidden="true" />,
    onClick: () => openNotificationDrawer(),
  },
];

<WorksCalendar
  events={events}
  leftRailExtras={railExtras}
  rightPanelExtras={
    <>
      <RightPanelSection title="Open tickets">
        <MyTicketWidget />
      </RightPanelSection>
      <RightPanelSection title="Compliance">
        <MyComplianceWidget />
      </RightPanelSection>
    </>
  }
/>
```

`leftRailExtras` takes `LeftRailAction[]` (`id` / `label` / `icon` /
optional `hint` / optional `active` / `onClick`). Built-in ids
(`saved-views`, `focus`, `settings`) are reserved — extras using them
are filtered out so a typo can't shadow the chrome.

`rightPanelExtras` takes any `ReactNode`. Wrap each section in
`<RightPanelSection title="…">` so theme tokens + section dividers
match the stock content above.

## Optional view plugins

Some views are shipped behind optional peer dependencies so the core bundle
stays slim. They are auto-detected at runtime — install the peers and the view
renders; skip them and a graceful install hint is shown instead.

### Map view

Plot events with coordinates on a MapLibre basemap.

```bash
npm install maplibre-gl react-map-gl
```

```jsx
import { WorksCalendar } from 'works-calendar';

const events = [
  {
    id: 'kphx-1',
    title: 'Phoenix arrival',
    start: new Date(),
    meta: { coords: { lat: 33.43, lon: -112.01 } },
  },
];

<WorksCalendar events={events} initialView="map" />;
```

Coordinates are read from `event.meta.coords` (`{ lat, lon }`, matching the
`LocationData` shape) — `event.meta.lat` + `event.meta.lon`/`meta.lng` is also
accepted as a loose convenience form. Marker color resolves through the same
`colorRules` as every other view.

`MapView` is also exported standalone for custom layouts:

```jsx
import { MapView } from 'works-calendar';

<MapView
  events={events}
  onEventClick={ev => console.log(ev)}
  mapStyle="https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY"
/>;
```

The default `mapStyle` is MapLibre's free demo tile server — fine for local
development; production hosts should pass their own style URL (MapTiler,
Stadia, Protomaps, self-hosted, …).

## Release & project status

- [Release readiness checklist](./docs/release-readiness.md)
- [Product roadmap](./docs/Roadmap.md)
- [Initial release notes draft](./docs/releases/v0.1.0.md)

## License

MIT. See [LICENSE](./LICENSE).
