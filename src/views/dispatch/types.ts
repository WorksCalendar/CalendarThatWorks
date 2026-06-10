/**
 * Generic types for the dispatch view. The view is asset-agnostic —
 * trucks, planes, employees, equipment. Anything with a position
 * over time renders here.
 *
 * Data comes in via WorksCalendar's existing `events` + `assets`
 * machinery; the engine handles conflicts and requirements. These
 * types are purely the view's projection/UI shapes.
 */

import type { NormalizedEvent } from 'works-calendar-engine';
import type { TravelMode } from '../../core/travel';
import type { AssetDomain, RouteGeometry } from '../../core/routing';

// ── Layer projection ────────────────────────────────────────────────────────

export type MapLayer = 'region' | 'state' | '5k' | '1k';

export interface LayerBounds {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
}

// ── Dispatch assets + stops ─────────────────────────────────────────────────
//
// Derived from the calendar's events at render time, not stored separately.
// `DispatchAsset` is the row in the sidebar; `DispatchStop` is one event in
// the asset's timeline (departure or arrival at a facility).

export interface DispatchAsset {
  /** Stable id — matches event.resource. */
  readonly id: string;
  /** Display label shown in the sidebar. */
  readonly name: string;
  /** Render color for dots / breadcrumbs. */
  readonly color: string;
  /** Optional human driver / operator name pulled from `asset.meta.driverName`.
   *  Surfaced in the dispatch Gantt header so dispatchers can answer
   *  "who's behind the wheel" at a glance. */
  readonly driverName?: string;
  /** Physical travel medium (ground / air / sea), resolved from the asset's
   *  travel mode. Drives the map glyph and route-geometry strategy. Defaults
   *  to `ground`. */
  readonly domain: AssetDomain;
}

export interface DispatchFacility {
  readonly code: string;
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
  /** Optional capacity hint (e.g. dock count). */
  readonly capacity?: number;
}

export interface DispatchStop {
  /** Event the stop came from (mostly for click-through to detail). */
  readonly event: NormalizedEvent;
  readonly assetId: string;
  readonly facilityCode: string;
  readonly time: Date;
  readonly lat: number;
  readonly lng: number;
  readonly kind: 'departure' | 'arrival';
}

/**
 * A modeled "time to arrive" for a leg, computed from the leg's distance
 * and the asset's travel profile (car / walking / aircraft). Independent of
 * the scheduled clock gap — comparing the two tells a dispatcher whether a
 * leg is padded or physically infeasible.
 */
export interface TravelEstimate {
  readonly mode: TravelMode;
  readonly profileLabel: string;
  readonly minutes: number;
}

/** One leg between two consecutive stops on the same asset. */
export interface DispatchSegment {
  readonly assetId: string;
  readonly from: DispatchStop;
  readonly to: DispatchStop;
  /** Modeled travel time for the leg; omitted when it can't be computed. */
  readonly estimate?: TravelEstimate;
  /** Resolved route geometry for the leg — the polyline the map draws and
   *  the marker rides along. Omitted only when the leg is degenerate. */
  readonly route?: RouteGeometry;
}

/** A pairwise conflict at a facility — produced by the engine, rendered here. */
export interface DispatchConflict {
  readonly facilityCode: string;
  readonly assetA: string;
  readonly assetB: string;
  readonly timeA: Date;
  readonly timeB: Date;
}
