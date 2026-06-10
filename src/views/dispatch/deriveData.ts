/**
 * Build the dispatch view's render-time data from the calendar's existing
 * event + asset streams. The view itself is asset-agnostic — it just needs:
 *
 *   - a list of unique assets (sidebar rows)
 *   - their stops over time (map markers + breadcrumbs)
 *   - the facilities those stops happen at (anchor circles on the map)
 *
 * Position lives in `event.meta.lat / event.meta.lng`. Facility identity
 * in `event.meta.facilityCode` (string). Stop kind in
 * `event.meta.stopType` ('arrival' | 'departure'). These are the
 * conventions the truck demo uses; any host can populate the same fields
 * for their domain (planes, crews, drones).
 */
import type { NormalizedEvent } from 'works-calendar-engine';
import { estimateTravelMinutes, resolveTravelProfile } from '../../core/travel';
import {
  basicRouteEngine,
  bearingDeg,
  resolveAssetDomain,
  sampleRoute,
  type RouteGeometry,
  type RouteProvider,
} from '../../core/routing';
import type {
  DispatchAsset,
  DispatchFacility,
  DispatchSegment,
  DispatchStop,
  TravelEstimate,
} from './types';

/** Host hook: ordered real-world waypoints a leg passes through, or null. */
export type RouteWaypointLookup = (
  fromCode: string,
  toCode: string,
) => readonly { lat: number; lng: number }[] | null;

/** Optional knobs for {@link deriveDispatchData}. */
export interface DeriveDispatchOptions {
  /** Asset-level fallback travel mode when none is declared. Default `car`. */
  readonly defaultTravelMode?: string;
  /** Host-supplied corridor waypoints — fed to the route engine as anchors
   *  so ground legs trace real roads. */
  readonly getRouteWaypoints?: RouteWaypointLookup;
  /** Route source. Defaults to the built-in, network-free engine. A provider
   *  that resolves asynchronously is ignored here (routes stay undefined);
   *  async resolution is a higher layer's job. */
  readonly routeProvider?: RouteProvider;
}

/** Stable color fallback when an asset doesn't supply meta.color. */
const FALLBACK_PALETTE = [
  '#e74c3c', '#e67e22', '#f39c12', '#27ae60', '#2980b9',
  '#8e44ad', '#c0392b', '#d35400', '#16a085', '#2c3e50',
];

interface RawAssetEntry {
  readonly id: string;
  readonly label: string;
  readonly group?: string;
  readonly meta?: Record<string, unknown>;
}

function pickColor(meta: Record<string, unknown> | undefined, index: number): string {
  const m = meta?.['color'];
  if (typeof m === 'string' && m.startsWith('#')) return m;
  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length]!;
}

function extractCoord(event: NormalizedEvent, key: 'lat' | 'lng'): number | null {
  const v = event.meta?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function extractFacility(event: NormalizedEvent): { code: string; name: string } | null {
  const code = event.meta?.['facilityCode'];
  if (typeof code !== 'string' || !code) return null;
  const name = event.meta?.['facilityName'];
  return {
    code,
    name: typeof name === 'string' && name ? name : code,
  };
}

function extractStopKind(event: NormalizedEvent): 'arrival' | 'departure' {
  const v = event.meta?.['stopType'];
  return v === 'departure' ? 'departure' : 'arrival';
}

export interface DerivedDispatchData {
  readonly assets: DispatchAsset[];
  readonly facilities: DispatchFacility[];
  readonly stopsByAsset: ReadonlyMap<string, DispatchStop[]>;
  readonly segmentsByAsset: ReadonlyMap<string, DispatchSegment[]>;
}

/**
 * Resolve a leg's travel mode: the departing stop's `event.meta.travelMode`
 * wins (per-leg override), otherwise the asset-level default supplied by the
 * caller. Lets a mixed fleet (trucks + a courier plane) model each leg with
 * the right profile.
 */
function legTravelMode(
  from: DispatchStop,
  assetModes: ReadonlyMap<string, string>,
  defaultMode: string,
): string {
  const perEvent = from.event.meta?.['travelMode'];
  if (typeof perEvent === 'string' && perEvent) return perEvent;
  return assetModes.get(from.assetId) ?? defaultMode;
}

function computeEstimate(
  from: DispatchStop,
  to: DispatchStop,
  mode: string,
): TravelEstimate | undefined {
  const profile = resolveTravelProfile(mode);
  const minutes = estimateTravelMinutes(
    { lat: from.lat, lon: from.lng },
    { lat: to.lat, lon: to.lng },
    profile,
  );
  if (!Number.isFinite(minutes)) return undefined;
  return { mode: profile.mode, profileLabel: profile.label, minutes };
}

/**
 * Resolve a leg's route geometry. Feeds any host-supplied corridor waypoints
 * into the provider as anchors (so ground legs trace real roads) and tags the
 * request with the leg's domain (ground / air / sea). Only synchronous
 * providers are honored here; an async provider yields no geometry and the
 * map falls back to its arch/straight rendering.
 */
function resolveLegRoute(
  from: DispatchStop,
  to: DispatchStop,
  mode: string,
  getRouteWaypoints: RouteWaypointLookup | undefined,
  provider: RouteProvider,
): RouteGeometry | undefined {
  const domain = resolveAssetDomain(mode);
  const anchors = getRouteWaypoints?.(from.facilityCode, to.facilityCode) ?? undefined;
  const result = provider.resolveRoute({
    from: { lat: from.lat, lng: from.lng },
    to: { lat: to.lat, lng: to.lng },
    domain,
    ...(anchors && anchors.length > 0 ? { anchors } : {}),
  });
  if (result instanceof Promise) return undefined;
  return result;
}

export function deriveDispatchData(
  events: readonly NormalizedEvent[],
  assets: readonly RawAssetEntry[] = [],
  options: DeriveDispatchOptions = {},
): DerivedDispatchData {
  const {
    defaultTravelMode = 'car',
    getRouteWaypoints,
    routeProvider = basicRouteEngine,
  } = options;

  // ── Assets ── union of declared assets and event.resource ids ──
  const assetIndex = new Map<string, DispatchAsset>();
  const assetModes = new Map<string, string>();
  assets.forEach((a, i) => {
    const drv = a.meta?.['driverName'];
    const mode = a.meta?.['travelMode'];
    if (typeof mode === 'string' && mode) assetModes.set(a.id, mode);
    assetIndex.set(a.id, {
      id: a.id,
      name: a.label,
      color: pickColor(a.meta, i),
      domain: resolveAssetDomain(typeof mode === 'string' ? mode : defaultTravelMode),
      ...(typeof drv === 'string' && drv ? { driverName: drv } : {}),
    });
  });
  events.forEach((ev) => {
    const id = ev.resource;
    if (!id || assetIndex.has(id)) return;
    assetIndex.set(id, {
      id,
      name: id,
      color: pickColor(undefined, assetIndex.size),
      domain: resolveAssetDomain(defaultTravelMode),
    });
  });

  // ── Facilities ── unique by code, location pulled from the first event mentioning them
  const facilityIndex = new Map<string, DispatchFacility>();
  for (const ev of events) {
    const f = extractFacility(ev);
    if (!f || facilityIndex.has(f.code)) continue;
    const lat = extractCoord(ev, 'lat');
    const lng = extractCoord(ev, 'lng');
    if (lat == null || lng == null) continue;
    facilityIndex.set(f.code, { code: f.code, name: f.name, lat, lng });
  }

  // ── Stops ── one per event with valid coords; sorted by time per asset
  const stopsByAsset = new Map<string, DispatchStop[]>();
  for (const ev of events) {
    if (!ev.resource) continue;
    const lat = extractCoord(ev, 'lat');
    const lng = extractCoord(ev, 'lng');
    if (lat == null || lng == null) continue;
    const facility = extractFacility(ev);
    if (!facility) continue;
    const list = stopsByAsset.get(ev.resource) ?? [];
    list.push({
      event: ev,
      assetId: ev.resource,
      facilityCode: facility.code,
      time: ev.start,
      lat,
      lng,
      kind: extractStopKind(ev),
    });
    stopsByAsset.set(ev.resource, list);
  }
  for (const list of stopsByAsset.values()) {
    list.sort((a, b) => a.time.getTime() - b.time.getTime());
  }

  // ── Segments ── pair adjacent stops that move between facilities.
  // A real drive leg is anchored by a departure at A: from = departure,
  // to = the next stop at a different facility. If we paired arrival-at-A
  // with arrival-at-B directly, the resulting interval would include all
  // the dwell time at A and the dispatch view would show a phantom
  // "En route 4h to arrival" for a truck that was actually parked. Hosts
  // that only emit arrival stops therefore get no synthetic drive bars —
  // which is honest, since we don't know when the truck actually moved.
  const segmentsByAsset = new Map<string, DispatchSegment[]>();
  for (const [assetId, stops] of stopsByAsset) {
    const segs: DispatchSegment[] = [];
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i]!;
      const b = stops[i + 1]!;
      if (a.facilityCode === b.facilityCode) continue;
      if (a.kind !== 'departure') continue;
      const mode = legTravelMode(a, assetModes, defaultTravelMode);
      const estimate = computeEstimate(a, b, mode);
      const route = resolveLegRoute(a, b, mode, getRouteWaypoints, routeProvider);
      segs.push({
        assetId,
        from: a,
        to: b,
        ...(estimate ? { estimate } : {}),
        ...(route ? { route } : {}),
      });
    }
    segmentsByAsset.set(assetId, segs);
  }

  return {
    assets: Array.from(assetIndex.values()),
    facilities: Array.from(facilityIndex.values()),
    stopsByAsset,
    segmentsByAsset,
  };
}

/** Interpolate an asset's position between its adjacent stops at time `t`. */
export function positionAt(
  stops: readonly DispatchStop[] | undefined,
  t: Date,
): { lat: number; lng: number; facilityCode?: string; moving: boolean } | null {
  if (!stops || stops.length === 0) return null;
  const tMs = t.getTime();
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  if (tMs <= first.time.getTime()) {
    return { lat: first.lat, lng: first.lng, facilityCode: first.facilityCode, moving: false };
  }
  if (tMs >= last.time.getTime()) {
    return { lat: last.lat, lng: last.lng, facilityCode: last.facilityCode, moving: false };
  }
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    if (tMs < a.time.getTime() || tMs > b.time.getTime()) continue;
    if (a.facilityCode === b.facilityCode) {
      return { lat: a.lat, lng: a.lng, facilityCode: a.facilityCode, moving: false };
    }
    const span = b.time.getTime() - a.time.getTime();
    const p = span === 0 ? 0 : (tMs - a.time.getTime()) / span;
    return {
      lat: a.lat + (b.lat - a.lat) * p,
      lng: a.lng + (b.lng - a.lng) * p,
      moving: true,
    };
  }
  return null;
}

/** Position + heading sampled at time `t`, walking the resolved route. */
export interface AssetSample {
  readonly lat: number;
  readonly lng: number;
  /** Travel heading in degrees (0=N, 90=E); 0 when parked. */
  readonly headingDeg: number;
  readonly moving: boolean;
  /** Fraction of the active leg covered, [0,1]; 0 when parked. */
  readonly legFraction: number;
  readonly facilityCode?: string;
  /** The leg currently being traveled, if any. */
  readonly activeSegment?: DispatchSegment;
}

/**
 * Route-aware position sampler. While an asset is mid-leg it rides the
 * segment's resolved {@link RouteGeometry} — distance-parameterized, so the
 * marker tracks the drawn polyline instead of cutting a straight chord — and
 * reports its heading so the map can face the glyph down the road. Falls back
 * to straight-line interpolation when a leg has no geometry, and to the
 * nearest stop while parked / dwelling.
 *
 * `segments` must be the asset's own leg list (sorted by departure time, as
 * {@link deriveDispatchData} produces); `stops` is the same asset's full stop
 * list, used for the parked/clamped cases the segments don't cover.
 */
export function assetPositionAt(
  stops: readonly DispatchStop[] | undefined,
  segments: readonly DispatchSegment[] | undefined,
  t: Date,
): AssetSample | null {
  if (!stops || stops.length === 0) return null;
  const tMs = t.getTime();

  // Mid-leg? Ride the route geometry.
  for (const seg of segments ?? []) {
    const start = seg.from.time.getTime();
    const end = seg.to.time.getTime();
    if (tMs < start || tMs >= end) continue;
    const span = end - start;
    const frac = span <= 0 ? 0 : (tMs - start) / span;
    if (seg.route) {
      const s = sampleRoute(seg.route, frac);
      return {
        lat: s.lat,
        lng: s.lng,
        headingDeg: s.headingDeg,
        moving: true,
        legFraction: frac,
        activeSegment: seg,
      };
    }
    return {
      lat: seg.from.lat + (seg.to.lat - seg.from.lat) * frac,
      lng: seg.from.lng + (seg.to.lng - seg.from.lng) * frac,
      headingDeg: bearingDeg(seg.from, seg.to),
      moving: true,
      legFraction: frac,
      activeSegment: seg,
    };
  }

  // Parked: clamp to the latest stop at or before `t` (first stop if before all).
  let cur = stops[0]!;
  for (const s of stops) {
    if (s.time.getTime() <= tMs) cur = s;
    else break;
  }
  return {
    lat: cur.lat,
    lng: cur.lng,
    headingDeg: 0,
    moving: false,
    legFraction: 0,
    facilityCode: cur.facilityCode,
  };
}
