# AssetMapWidget (optional integration)

`AssetMapWidget` is a strict, **map-agnostic** situational-awareness overlay
that lives **alongside** `<WorksCalendar />` rather than inside it. Use it
when you want a "where are my assets right now?" peek without forcing users
to switch to the full Map view.

> Why not a calendar tab? The calendar's job is scheduling; live positions
> are situational awareness. Keeping them as a separate overlay means
> the calendar stays renderer-free and the widget can scale from a 200 px
> peek pill to a fullscreen ops console without affecting the schedule grid.

## Three modes, one component

```
┌──────────────────────────────┐
│ WorksCalendar                │
│                              │
│                      ┌─────┐ │
│                      │ MAP │ │  ← peek (default)
│                      └─────┘ │
└──────────────────────────────┘
```

| Mode         | Trigger                        | What it shows |
| ------------ | ------------------------------ | ------------- |
| `peek`       | initial; click → `panel`       | corner pill: title, asset count, stale-dot if any positions are aged out |
| `panel`      | click peek; expand → fullscreen | 360 × 280 floating card with the renderer (or SVG fallback) |
| `fullscreen` | expand button                  | full-viewport ops map; restore returns to `panel` |

## Installation

The widget ships on its own subpath so the main calendar bundle stays
unaffected for hosts that don't need it:

```bash
# already in your dependencies
npm install works-calendar
```

No extra runtime peers are required for the **fallback SVG plot** — useful
for QA, demos, or when you just want a low-fidelity overview. To render a
real basemap, supply a `WorksCalendarMapAdapter` (see "Bring your own
renderer" below). The widget itself never imports MapLibre, Leaflet, or
Cesium.

## Quick start (fallback plot)

```tsx
import { WorksCalendar } from 'works-calendar';
import { AssetMapWidget } from 'works-calendar/integrations/asset-map-widget';
import 'works-calendar/styles';

const positions = [
  {
    id: 'ac-n801aw',
    label: 'AW139 N801AW',
    lat: 47.45, lon: -122.31,
    altitude: null, heading: null, speed: null,
    timestamp: Math.floor(Date.now() / 1000),
    source: 'demo',
  },
  // …more AssetTrackerPosition records
];

<>
  <WorksCalendar /* …calendar props… */ />
  <AssetMapWidget positions={positions} position="top-right" />
</>
```

The widget reads `AssetTrackerPosition[]` — the same shape produced by
[`works-calendar/integrations/asset-tracker`](./LocationProvider.md) and the
[`Map_Idea` asset-tracker](https://github.com/natehorst240-sketch/Map_Idea)
project. Invalid positions (NaN coords, out-of-range lat/lon, missing
timestamps) are silently skipped via `isValidPosition`.

## Bring your own renderer

Production deployments should pass a `WorksCalendarMapAdapter`. The contract
is intentionally minimal:

```ts
interface WorksCalendarMapAdapter {
  mount(container: HTMLElement): void;
  updatePositions(positions: readonly AssetTrackerPosition[]): void;
  focusPosition(id: string): void;
  destroy(): void;
}
```

The widget will:

1. Call `mount(container)` once when the panel/fullscreen view opens, with a
   `<div>` already sized to the body container.
2. Push every render to `updatePositions(positions)` — the adapter decides
   its own diffing strategy.
3. Call `destroy()` on unmount or when the adapter prop identity changes.

Example wiring against MapLibre:

```tsx
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type {
  WorksCalendarMapAdapter,
  AssetTrackerPosition,
} from 'works-calendar/integrations/asset-map-widget';

function createMaplibreAdapter(styleUrl: string): WorksCalendarMapAdapter {
  let map: maplibregl.Map | null = null;
  const markers = new Map<string, maplibregl.Marker>();

  return {
    mount(container) {
      map = new maplibregl.Map({ container, style: styleUrl, center: [0, 20], zoom: 2 });
    },
    updatePositions(positions) {
      if (!map) return;
      const seen = new Set<string>();
      for (const p of positions) {
        seen.add(p.id);
        const existing = markers.get(p.id);
        if (existing) {
          existing.setLngLat([p.lon, p.lat]);
        } else {
          markers.set(p.id, new maplibregl.Marker().setLngLat([p.lon, p.lat]).addTo(map));
        }
      }
      for (const [id, marker] of markers) {
        if (!seen.has(id)) { marker.remove(); markers.delete(id); }
      }
    },
    focusPosition(id) {
      const m = markers.get(id);
      if (m && map) map.flyTo({ center: m.getLngLat(), zoom: 8 });
    },
    destroy() {
      for (const m of markers.values()) m.remove();
      markers.clear();
      map?.remove();
      map = null;
    },
  };
}
```

You can ship the adapter as its own package (`asset-tracker-maplibre`,
`asset-tracker-leaflet`, `asset-tracker-cesium`, …); the calendar package
never depends on it.

## Props

| Prop                    | Type                                              | Default        | Notes |
| ----------------------- | ------------------------------------------------- | -------------- | ----- |
| `positions`             | `readonly AssetTrackerPosition[]`                 | required       | Filtered through `isValidPosition` before render. |
| `adapter`               | `WorksCalendarMapAdapter`                         | —              | Omit for the dependency-free SVG fallback. |
| `initialMode`           | `'peek' \| 'panel' \| 'fullscreen'`               | `'peek'`       | Persist via `onModeChange` if you want to restore. |
| `position`              | `'top-right' \| 'top-left' \| 'bottom-right' \| 'bottom-left'` | `'top-right'` | Anchor for `peek` and `panel`. |
| `staleThresholdSeconds` | `number`                                          | `120`          | Above this, a position renders with the stale color and counts toward the peek's stale dot. |
| `nowSeconds`            | `() => number`                                    | `Math.floor(Date.now() / 1000)` | Returns **epoch seconds**, not milliseconds — matches `AssetTrackerPosition.timestamp`. Override for tests / SSR snapshots. |
| `title`                 | `string`                                          | `'Asset map'`  | Shown in the peek pill and toolbar. |
| `onModeChange`          | `(mode) => void`                                  | —              | Fired on every transition so hosts can persist `panel` / `fullscreen`. |

## When to pick the widget vs `MapView`

| Need                                    | Use                                |
| --------------------------------------- | ---------------------------------- |
| "Where are my assets right now?"         | `AssetMapWidget` (this page)        |
| "Plot scheduled events on a basemap"     | [`MapView`](./MapView.md)            |
| Both                                    | Render both — they share zero state |

`MapView` reads from the calendar's event list (anything with
`meta.coords`); `AssetMapWidget` reads live positions independent of the
schedule. Real ops centers usually want both.

## Architecture (why it's split out)

- The integration subpath ships only what it needs: ~8 KB gzipped.
- `WorksCalendar` itself never imports a map renderer. The single
  contract between them is `resource.meta.tracking` (set by the
  `asset-tracker` integration).
- Adapters are external. `asset-tracker-maplibre`, `-leaflet`, `-cesium`,
  or any custom renderer can satisfy `WorksCalendarMapAdapter` — the
  widget doesn't care.

See also: [`LocationProvider`](./LocationProvider.md),
[`MapView`](./MapView.md).
