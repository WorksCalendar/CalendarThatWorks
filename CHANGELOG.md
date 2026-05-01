# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

Library and demo changes since 0.5.0 that originated in the
guided-walkthrough work — limited to the public-API surface a downstream
consumer would feel. Many other PRs have landed against `main` since
0.5.0 (strict-null migration, asset setup flow, dispatch board, base
view redesign, map layer, invoicing integration, etc.); those should be
folded into this section by their respective authors before the next
release is cut.

### Added

- **`onViewChange?: (view: CalendarView) => void`** prop on
  `<WorksCalendar>`. Fires whenever the active view changes (toolbar
  click, keyboard shortcut, programmatic `cal.setView`, saved-view
  apply). Skips the initial mount so consumers don't get a synthetic
  event for the default view.
- **`onMapWidgetOpenChange?: (open: boolean) => void`** prop on
  `<WorksCalendar>`, forwarded to the embedded `<MapPeekWidget>`. Fires
  on the open / close transition of the rail map peek's expanded modal.
- **`onOpenChange?: (open: boolean) => void`** prop on `MapPeekWidget`.
  Same semantics as the WorksCalendar passthrough above; useful when
  embedding the widget directly outside the calendar.
- **`leftRailExtras?: LeftRailAction[]`** prop on `<WorksCalendar>`.
  Appended after the built-in saved-views / focus / settings buttons so
  embedders can plug their own icon shortcuts (export, notifications,
  custom drawers, etc.) into the chrome. Built-in ids are reserved —
  extras with `id` matching `'saved-views'` / `'focus'` / `'settings'`
  are filtered out defensively.
- **`rightPanelExtras?: ReactNode`** prop on `<WorksCalendar>`. Appended
  after the built-in Region map + Crew on shift sections. For visual
  consistency wrap each section in
  `<RightPanelSection title="…">…</RightPanelSection>` (also exported);
  theme tokens + section dividers stay aligned with the stock chrome.
- **New public exports** to support the slot props:
  - `RightPanel`, `RightPanelSection` (components)
  - `RightPanelSectionProps`, `LeftRailAction` (types)
- **DOM hooks for host tooling**:
  - `data-wc-event-id="<id>"` on event pills in Day, Week, Month, and
    Schedule views. Lets host code (e.g. tour overlays, automated
    tests) target a specific event pill across views by id rather than
    the volatile module-scoped CSS class.
  - `data-wc-view-button="<viewId>"` on the toolbar view buttons so
    automation can pick a specific view button without relying on
    accessible-name regexes.
  - `data-wc-map-widget="peek"` on the `MapPeekWidget` host wrapper.

### Changed

- **WeekView pills no longer render duplicate time text.** The pill's
  vertical position and height already encode the start / end visually,
  and the timeRange ("8:00 AM – 4:00 PM") + Start / End rows just
  starved the title of legible space when columns were narrow. Pills
  now render the title (with ApprovalDot + EventStatusBadge prefixes)
  and Resource only. **The pill `aria-label` retains the full hour
  range for screen readers.** Visual change for any consumer asserting
  on those exact strings.
- **LeftRail + RightPanel surfaces now extend the full body height.**
  Previously the inner `.root` of each rail collapsed to content height,
  leaving a transparent gap below the buttons / sections that bled the
  parent surface through and made the rails read as "cut off" against
  a tall calendar grid. Now both inner roots `height: 100%` so their
  surface + border match the body's bottom edge.
- **Demo dataset is now date-relative.** `demo/emsData.ts` and the
  walkthrough's seed events used to hardcode the week of 2026-04-20.
  Once the system clock moved past that week, the events fell outside
  the calendar's visible window and visitors saw a blank demo.
  Replaced 26 hardcoded ISO date strings with offsets relative to
  `startOfWeek(new Date(), { weekStartsOn: 1 })`. The schedule shape
  is preserved exactly; the dataset just slides forward with real time.
  Only affects consumers who imported `emsData` directly (it's a demo
  fixture, not part of the public API surface), but called out for
  visibility.

### Breaking

- **`TimelineView` component renamed to `ScheduleView`.** The toolbar
  user-facing label has always been "Schedule" and the view id has
  always been `'schedule'`; the internal component name was an
  outlier. The public re-export is now `import { ScheduleView } from
  'works-calendar'` (was `TimelineView`). The view id stays
  `'schedule'`, so consumer config (`display.defaultView`,
  `cal.setView('schedule')`, saved views, etc.) does **not** need to
  change.
- **Dead `ScheduleView` 6-week grid component removed.** This was an
  earlier prototype that hadn't been re-rendered since the production
  ScheduleView (formerly TimelineView) shipped. It had no public
  re-export and no consumer references, but is being noted here for
  completeness in case a consumer was reaching into `src/views/`
  directly.

## [0.5.0] — 2026-04-19

The "Full TypeScript" release. The library is now written end-to-end in
strict TypeScript, with `dist/index.d.ts` generated from source by
`vite-plugin-dts` instead of a hand-maintained 826-line `.d.ts` that
silently drifted from the JS implementation. All `.js`/`.jsx` files under
`src/`, `demo/`, and `examples/` have been converted to `.ts`/`.tsx`.

### Added

- **Generated type declarations** — `dist/index.d.ts` is now produced by
  `vite-plugin-dts` from the TypeScript source, so the published types
  cannot drift from the implementation. Public types include
  `WorksCalendarEvent`, `NormalizedEvent`, `WorksCalendar`, `CalendarApi`,
  the `api/v1` engine schema, grouping types, and the assets module.
- **`type-check` script** (`npm run type-check`) and CI step that runs
  `tsc --noEmit` against the strict configuration.

### Changed

- **All source converted to TypeScript** — 179 internal modules across
  `src/`, plus `demo/` and `examples/`, are now `.ts`/`.tsx`. Vite/Vitest
  configs are TypeScript too.
- **Strict-mode TypeScript enabled** — `strict: true` is now on, with
  pragmatic short-term opt-outs for `noImplicitAny` and `strictNullChecks`
  to keep the migration shippable; these will be tightened in a follow-up.
- **`tsExtensionFallback` Vite plugin removed** — internal imports are now
  extensionless and resolved by bundler module resolution.

### Breaking

- **`NormalizedEvent` import path change.** The internal-but-exported
  `NormalizedEvent` type used to be importable from
  `'works-calendar/src/index.d.ts'` (or transitively through legacy
  module-augmentation paths). It now lives at the public API surface and
  is only importable from the package root: `import type { NormalizedEvent }
  from 'works-calendar'`. Consumers reaching into `src/index.d.ts`
  directly (which never existed as a public path) must migrate.

## [0.4.0] — 2026-04-18

The "UX Polish Pass" release. Five short sprints turned a workflow-rich but
sometimes-overwhelming calendar into something faster to learn and easier to
live in day-to-day.

### Added

- **Keyboard shortcuts** for view switching (`1`–`6`), navigation
  (`j`/`k`, `ArrowLeft`/`ArrowRight`), today (`t`), and a discoverability
  cheat sheet (`?`). Shortcuts are guarded against text-input focus,
  modifier keys, and open modal dialogs. See `useKeyboardShortcuts`.
- **Keyboard help overlay** — an accessible, focus-trapped dialog listing
  every binding, opened with `?` or via the toolbar.
- **Owner login modal** — replaces the inline gear-button popover with a
  proper aria-modal dialog, complete with focus trap, password reveal
  toggle, and inline error messaging.
- **Settings IA refactor** — ConfigPanel tabs are now grouped into four
  collapsible sections (Appearance, Data, Workflows, Access) with a
  vertical sidebar layout. The active tab's section auto-expands.
- **Create-shift fallback** — Schedule view date-select now routes to the
  generic `EventForm` when the dropped cell isn't a configured employee,
  instead of silently dropping the interaction.
- **`assetRequestCategories` prop** on `<WorksCalendar>` (optional).
  When provided alongside an `assets` registry, AssetsView renders a
  primary "Request Asset" toolbar button that opens a focused modal
  (`AssetRequestForm`). Submissions route through the normal
  `onEventSave` path with `meta.approvalStage = { stage: 'requested' }`,
  so the existing approvals state machine handles the rest
  (approve / deny / finalize / escalate to higher). Categories are
  constrained to the host-configured ids — the demo ships
  `['maintenance', 'pr', 'training', 'aircraft-movement']` with a new
  Aircraft Movement category.
- **`strictAssetFiltering` prop** on `<WorksCalendar>` (default `false`).
  When `true` and an `assets` registry is provided, AssetsView keeps
  only events whose `resource` matches a registered asset id — drops
  both foreign-id events (e.g. employees in a unified calendar) and
  null/empty-resource events (e.g. team-wide meetings that belong on
  Schedule). This mirrors TimelineView's implicit scoping to the
  `employees` prop, letting host apps feed one unified event list to a
  calendar that shows people on Schedule and aircraft on Assets.
- **Unified demo** — `demo/App.jsx` no longer has a separate
  Engineering/Fleet dataset toggle. Both people (on-call rotations,
  incidents, PTO) and aircraft (charters, maintenance with approval
  workflow) now live in one event array, rendered together via the new
  `strictAssetFiltering` flag.

### Fixed

- **Agenda view multi-day events (#148)** — events that span multiple
  calendar days now render on every day they cover, not just their start
  day. Multi-day timed events show a `MMM d, h:mm a → MMM d, h:mm a` meta
  string; multi-day all-day events show `All day · MMM d → MMM d`.

### Notes

- Test suite expanded by 30+ unit tests covering the new shortcut hook,
  help overlay, owner login modal, ConfigPanel focus trap, and the
  agenda multi-day regression.
