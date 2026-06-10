# Routing engine

The dispatch map's routes are produced by a small, self-contained routing
engine (`src/core/routing/`). It has **no bundled road dataset and makes no
network calls** — it turns the data it has into geometry the map draws and the
asset marker rides along, tied to the time slider.

## What it does

For each travel leg the dispatch view derives, the engine resolves a
[`RouteGeometry`](../src/core/routing/types.ts): an ordered, densified polyline
plus the cumulative distance at every vertex. That single geometry is used for
**both** the drawn breadcrumb and the moving marker, so the asset always tracks
the line you see instead of cutting a straight chord across it.

### Asset domains

Every leg is tagged with an `AssetDomain` — `ground`, `air`, or `sea` —
resolved from the asset's (or leg's) travel mode via `resolveAssetDomain`:

| Mode keywords                                             | Domain   |
| -------------------------------------------------------- | -------- |
| `car`, `walking`, anything unrecognized                  | `ground` |
| `aircraft`, `turboprop`, `airliner`, `helicopter`, …     | `air`    |
| `ship`, `boat`, `vessel`, `ferry`, `barge`, `ocean`, …   | `sea`    |

The domain drives both the geometry strategy and the map glyph (a
heading-rotated chevron for ground, a hull wedge for sea, etc.).

### Geometry strategies (`basicRouteEngine`)

- **Ground with anchors** — when the host supplies real corridor waypoints for
  a leg (see `getRouteWaypoints` below), the engine traces and smooths them
  with a centripetal Catmull-Rom spline. This is how a leg genuinely *follows
  the road*.
- **Ground without anchors** — synthesizes a believable, gently-bowed path
  (deterministic, so it never flickers as the slider scrubs) instead of a
  ruler-straight line.
- **Air / sea** — a lifted arc for now; these domains get dedicated geometry
  (great-circle flight paths, ocean-lane routing) in follow-up work.

## Feeding it real roads: `getRouteWaypoints`

The existing host hook is unchanged:

```tsx
<WorksCalendar
  getRouteWaypoints={(fromCode, toCode) =>
    myCorridors[`${fromCode}->${toCode}`] ?? null
  }
/>
```

Anything it returns is handed to the engine as **anchors** and smoothed into a
road-tracing polyline. Return `null` and the engine synthesizes a path instead.

## Bring your own provider

`basicRouteEngine` implements the [`RouteProvider`](../src/core/routing/types.ts)
interface, which is `async`-capable:

```ts
interface RouteProvider {
  id: string;
  resolveRoute(req: RouteRequest): RouteGeometry | Promise<RouteGeometry>;
}
```

A host can drop in a real directions API (OSRM, Mapbox, Google, …) later
without touching the call sites. The built-in derivation path (`deriveData`)
currently honors **synchronous** providers; async resolution is a higher-layer
concern handled in a future phase.

## Marker movement + cinematic leg

`assetPositionAt(stops, segments, t)` samples an asset's position **and
heading** at the scrubbed time by walking the active leg's geometry
distance-parameterized (`sampleRoute`). The focused asset's in-progress leg also
gets the "command center" treatment via `splitRoute`: a glowing *traveled*
trail behind the marker and a marching-ants *ahead* path to the destination.

## Status

Phase 1 ships **ground (truck) road-following** end to end. Air arcs with
planning-time conditions and automatic ocean/lake routing for sea assets build
on these same primitives in later phases.
