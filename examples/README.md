# WorksCalendar Examples

Run all examples locally:

```bash
npm install
npm run examples
```

## Core examples

- `00-DemoLanding.tsx` — guided demo entry page
- `01-GettingStarted.tsx` — minimum integration setup
- `02-BasicCalendar.tsx` — baseline calendar configuration
- `03-WithFilters.tsx` — schema-driven filter bar
- `04-TimelineScheduler.tsx` — timeline scheduler layout
- `05-CustomFilters.tsx` — custom filter schema fields
- `06-TeamCalendar.tsx` — multi-resource team scheduling
- `07-MultiSource.tsx` — merged multi-source data views
- `08-ShiftCoverageTracking.tsx` — PTO + coverage workflow
- `09-Grouping.tsx` — 1-, 2-, 3-level grouping presets
- `10-DragAndDrop.tsx` — drag events across groups / rows
- `11-Map.tsx` — geographic plot via the optional MapView plugin (see [docs/MapView.md](../docs/MapView.md))
- `12-MaintenanceAndInvoicing.tsx` — asset-health badges, in-form maintenance completion, CSV export for invoicing + maintenance log
- `13-AssetMapWidget.tsx` — peek/panel/fullscreen live-asset overlay via the optional `integrations/asset-map-widget` subpath (see [docs/AssetMapWidget.md](../docs/AssetMapWidget.md))

## Focused examples

- `setup-wizard.tsx` — owner onboarding wizard
- `advanced-filters.tsx` — nested smart-view filtering
- `data-adapter-local.tsx` — local-storage adapter
- `external-form.tsx` — standalone `CalendarExternalForm`
- `basic-usage.tsx` — compact docs/tutorial starter

## Feature demos

- `../demo/App.tsx` — unified calendar demo; wires resource pools with
  `localStorage` persistence (see
  [docs/ResourcePools.md](../docs/ResourcePools.md)).

## Related docs

- [Workflow map](./WORKFLOWS.md)
- [Documentation index](../docs/README.md)
- [Resource pools](../docs/ResourcePools.md)
- [Maintenance & invoicing integration](../docs/MaintenanceAndInvoicing.md)
- [Microsoft 365 adapter notes](./microsoft-365/README.md)
