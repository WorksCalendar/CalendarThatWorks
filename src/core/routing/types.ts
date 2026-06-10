/**
 * Routing engine types — shared shapes for the self-contained route engine
 * that powers the dispatch map's road-following breadcrumbs and the
 * slider-tied "ride the route" marker.
 *
 * The view is asset-agnostic, so routing is too: every request carries an
 * {@link AssetDomain} (ground / air / sea) and the engine returns a geometry
 * the map draws and the marker travels along. Pure data — no React, no
 * network — so it can run inside `deriveDispatchData` and in tests.
 *
 * Coordinates use the dispatch view's `{ lat, lng }` convention (the engine's
 * `haversineKm` wants `{ lat, lon }`; we convert at that boundary only).
 */

/** A single point on a route. `{ lat, lng }` to match the dispatch view. */
export interface RoutePoint {
  readonly lat: number;
  readonly lng: number;
}

/**
 * The physical medium an asset travels through. Drives both the route
 * geometry (roads vs. great-circle arc vs. ocean lane) and the map's
 * per-domain rendering (truck glyph vs. arced flight path vs. wake trail).
 *
 *   - `ground` — trucks, crews, anything road/path-bound.
 *   - `air`    — aircraft; rendered as a lifted arc.
 *   - `sea`    — vessels; routed across water.
 */
export type AssetDomain = 'ground' | 'air' | 'sea';

/** A request to resolve one leg between two points. */
export interface RouteRequest {
  readonly from: RoutePoint;
  readonly to: RoutePoint;
  /** Travel medium — selects the geometry strategy. */
  readonly domain: AssetDomain;
  /**
   * Optional real-world anchor points the leg is known to pass through
   * (e.g. highway-corridor waypoints the host supplies via
   * `getRouteWaypoints`). When present, the engine traces and smooths
   * these instead of synthesizing a path — this is how a route genuinely
   * "follows the road" without a bundled road dataset.
   */
  readonly anchors?: readonly RoutePoint[];
}

/** Where a route's geometry came from — useful for legends + debugging. */
export type RouteSource = 'anchors' | 'synthetic';

/**
 * A resolved route: an ordered, densified polyline plus the cumulative
 * distance at each vertex so callers can position by distance (not by
 * vertex index, which would lurch through long spans).
 */
export interface RouteGeometry {
  readonly domain: AssetDomain;
  readonly source: RouteSource;
  /** Ordered polyline, endpoints inclusive. Always ≥ 2 points. */
  readonly points: readonly RoutePoint[];
  /** Cumulative great-circle km at each point; `cumulativeKm[0] === 0`. */
  readonly cumulativeKm: readonly number[];
  /** Total path length in km (`=== cumulativeKm.at(-1)`). */
  readonly lengthKm: number;
}

/**
 * A pluggable route source. The built-in {@link BasicRouteEngine} is fully
 * synchronous, but the contract allows a `Promise` so a host can drop in a
 * real directions API (OSRM, Mapbox, Google, …) later without changing the
 * call sites.
 */
export interface RouteProvider {
  readonly id: string;
  resolveRoute(req: RouteRequest): RouteGeometry | Promise<RouteGeometry>;
}

/** A point sampled along a route: position + travel heading at that spot. */
export interface RouteSample extends RoutePoint {
  /** Compass bearing of travel in degrees (0 = north, 90 = east). */
  readonly headingDeg: number;
  /** Fraction of total distance covered, clamped to [0, 1]. */
  readonly fraction: number;
}
