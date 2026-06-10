/**
 * BasicRouteEngine — the built-in, self-contained route source.
 *
 * No bundled road dataset and no network: it produces geometry from what it
 * has. When the host supplies real anchor points for a leg (highway-corridor
 * waypoints via `getRouteWaypoints`), the engine *traces and smooths* them,
 * so the breadcrumb genuinely follows the road. When it has only the two
 * endpoints, it *synthesizes* a believable curved path — gently bowed with a
 * couple of deterministic bends — so a truck leg reads like a road rather
 * than a ruler-straight crow's flight.
 *
 * Ground is the focus of this phase. Air and sea resolve to a smooth arc for
 * now (a clearly-marked seam) and get dedicated geometry in follow-up work.
 *
 * Deterministic: the same request always yields the same geometry, so the
 * map never flickers as the slider scrubs and React re-renders.
 */
import { buildGeometry, catmullRom, segmentKm } from './geometry';
import type {
  AssetDomain,
  RouteGeometry,
  RoutePoint,
  RouteProvider,
  RouteRequest,
} from './types';

/** Density of the smoothed polyline. Higher = smoother + more vertices. */
const GROUND_SUBDIVISIONS = 14;
const ARC_SUBDIVISIONS = 28;

/**
 * Deterministic hash → unit float in [0,1) from a leg's endpoints, so the
 * synthetic bends are stable across renders but vary leg-to-leg.
 */
function hashUnit(from: RoutePoint, to: RoutePoint, salt: number): number {
  let h = 2166136261 ^ salt;
  const mix = (n: number) => {
    h ^= Math.round(n * 1000) | 0;
    h = Math.imul(h, 16777619);
  };
  mix(from.lat); mix(from.lng); mix(to.lat); mix(to.lng);
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Synthesize intermediate anchors for a ground leg with no real waypoints:
 * two interior points nudged perpendicular to the straight line by a small,
 * deterministic fraction of leg length. Just enough wander to read as a road
 * without pretending to be one. Returns endpoints inclusive.
 */
function syntheticGroundAnchors(from: RoutePoint, to: RoutePoint): RoutePoint[] {
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;
  // Perpendicular unit-ish vector in lat/lng space (good enough at this scale).
  const len = Math.hypot(dLat, dLng);
  if (len === 0) return [from, to];
  const px = -dLng / len;
  const py = dLat / len;
  // Bend magnitude: ~6–12% of leg length, alternating sides.
  const mag = len * (0.06 + 0.06 * hashUnit(from, to, 1));
  const side = hashUnit(from, to, 2) < 0.5 ? 1 : -1;
  const mk = (t: number, bow: number): RoutePoint => ({
    lat: from.lat + dLat * t + py * mag * bow * side,
    lng: from.lng + dLng * t + px * mag * bow * side,
  });
  return [from, mk(0.33, 0.85), mk(0.66, 0.55), to];
}

/**
 * A lifted arc between two endpoints — placeholder geometry for air/sea
 * until those domains get first-class routing. Bows the midpoint out so the
 * path reads as "not on the ground plane". Drawn flat in lat/lng; the map's
 * air rendering adds the vertical lift visually.
 */
function arcAnchors(from: RoutePoint, to: RoutePoint): RoutePoint[] {
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;
  const len = Math.hypot(dLat, dLng);
  if (len === 0) return [from, to];
  const px = -dLng / len;
  const py = dLat / len;
  const mag = len * 0.18;
  const mid: RoutePoint = {
    lat: (from.lat + to.lat) / 2 + py * mag,
    lng: (from.lng + to.lng) / 2 + px * mag,
  };
  return [from, mid, to];
}

function groundGeometry(req: RouteRequest): RouteGeometry {
  const { from, to, anchors } = req;
  // Anchors with at least one interior point mean the host gave us a real
  // corridor — trace it. Otherwise synthesize.
  const interior = (anchors ?? []).filter(
    (a) =>
      !(a.lat === from.lat && a.lng === from.lng) &&
      !(a.lat === to.lat && a.lng === to.lng),
  );
  if (interior.length > 0) {
    const full = [from, ...interior, to];
    return buildGeometry(catmullRom(full, GROUND_SUBDIVISIONS), 'ground', 'anchors');
  }
  return buildGeometry(
    catmullRom(syntheticGroundAnchors(from, to), GROUND_SUBDIVISIONS),
    'ground',
    'synthetic',
  );
}

function arcGeometry(req: RouteRequest, domain: AssetDomain): RouteGeometry {
  const { from, to, anchors } = req;
  const interior = (anchors ?? []).filter(
    (a) =>
      !(a.lat === from.lat && a.lng === from.lng) &&
      !(a.lat === to.lat && a.lng === to.lng),
  );
  const full = interior.length > 0 ? [from, ...interior, to] : arcAnchors(from, to);
  return buildGeometry(
    catmullRom(full, ARC_SUBDIVISIONS),
    domain,
    interior.length > 0 ? 'anchors' : 'synthetic',
  );
}

/**
 * The default {@link RouteProvider}. Synchronous and pure — safe to call
 * inside `deriveDispatchData` and memoized render paths.
 */
export const basicRouteEngine: RouteProvider = {
  id: 'basic',
  resolveRoute(req: RouteRequest): RouteGeometry {
    // Degenerate leg (same point) → a stub geometry the samplers handle.
    if (segmentKm(req.from, req.to) <= 0) {
      return buildGeometry([req.from, req.to], req.domain, 'synthetic');
    }
    switch (req.domain) {
      case 'ground':
        return groundGeometry(req);
      case 'air':
      case 'sea':
        return arcGeometry(req, req.domain);
      default:
        return groundGeometry(req);
    }
  },
};
