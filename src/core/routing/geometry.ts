/**
 * Route geometry math — distance helpers, Catmull-Rom smoothing, and
 * distance-parameterized sampling. Pure functions; the engine's
 * `haversineKm` does the great-circle work, we just convert `{lat,lng}`
 * (view convention) → `{lat,lon}` (engine convention) at the call.
 */
import { haversineKm } from 'works-calendar-engine';
import type { RouteGeometry, RoutePoint, RouteSample } from './types';

const DEG = Math.PI / 180;

/** Great-circle km between two `{lat,lng}` points. */
export function segmentKm(a: RoutePoint, b: RoutePoint): number {
  return haversineKm({ lat: a.lat, lon: a.lng }, { lat: b.lat, lon: b.lng });
}

/**
 * Initial compass bearing (deg, 0=N, 90=E) from `a` to `b`. Used to face
 * the moving marker down the route.
 */
export function bearingDeg(a: RoutePoint, b: RoutePoint): number {
  const φ1 = a.lat * DEG;
  const φ2 = b.lat * DEG;
  const Δλ = (b.lng - a.lng) * DEG;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x) / DEG;
  return (θ + 360) % 360;
}

/** Cumulative great-circle distance (km) at each vertex; `[0] === 0`. */
export function cumulativeKm(points: readonly RoutePoint[]): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1]! + segmentKm(points[i - 1]!, points[i]!));
  }
  return cum;
}

/**
 * Assemble a {@link RouteGeometry} from a bare polyline: dedupes adjacent
 * identical points, computes cumulative distances, and guarantees ≥ 2
 * points (collapsing to a zero-length stub if the caller passed garbage).
 */
export function buildGeometry(
  points: readonly RoutePoint[],
  domain: RouteGeometry['domain'],
  source: RouteGeometry['source'],
): RouteGeometry {
  const cleaned: RoutePoint[] = [];
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const prev = cleaned[cleaned.length - 1];
    if (prev && prev.lat === p.lat && prev.lng === p.lng) continue;
    cleaned.push({ lat: p.lat, lng: p.lng });
  }
  if (cleaned.length === 0) cleaned.push({ lat: 0, lng: 0 });
  if (cleaned.length === 1) cleaned.push({ ...cleaned[0]! });
  const cum = cumulativeKm(cleaned);
  return {
    domain,
    source,
    points: cleaned,
    cumulativeKm: cum,
    lengthKm: cum[cum.length - 1]!,
  };
}

/**
 * Smooth a sparse anchor list into a dense, organic polyline via a
 * centripetal Catmull-Rom spline. Endpoints are duplicated so the curve
 * passes through the first and last anchors. `subdivisions` controls how
 * many points each span is split into (more = smoother + heavier).
 *
 * A 2-point input is a straight line; Catmull-Rom on it just adds collinear
 * points, so we short-circuit and return the endpoints unchanged.
 */
export function catmullRom(
  anchors: readonly RoutePoint[],
  subdivisions = 12,
): RoutePoint[] {
  if (anchors.length <= 2) return anchors.map((a) => ({ lat: a.lat, lng: a.lng }));
  const pts = [anchors[0]!, ...anchors, anchors[anchors.length - 1]!];
  const out: RoutePoint[] = [];
  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2]!;
    for (let s = 0; s < subdivisions; s++) {
      const t = s / subdivisions;
      const t2 = t * t;
      const t3 = t2 * t;
      // Catmull-Rom basis (uniform, tension 0.5).
      const a0 = -0.5 * t3 + t2 - 0.5 * t;
      const a1 = 1.5 * t3 - 2.5 * t2 + 1;
      const a2 = -1.5 * t3 + 2 * t2 + 0.5 * t;
      const a3 = 0.5 * t3 - 0.5 * t2;
      out.push({
        lat: a0 * p0.lat + a1 * p1.lat + a2 * p2.lat + a3 * p3.lat,
        lng: a0 * p0.lng + a1 * p1.lng + a2 * p2.lng + a3 * p3.lng,
      });
    }
  }
  out.push({ lat: anchors[anchors.length - 1]!.lat, lng: anchors[anchors.length - 1]!.lng });
  return out;
}

/**
 * Sample a route at `fraction` of its total distance (clamped to [0,1]),
 * returning the interpolated position and the travel heading there.
 * Distance-parameterized: a leg that bows far out doesn't make the marker
 * speed up through the straight bits.
 */
export function sampleRoute(geo: RouteGeometry, fraction: number): RouteSample {
  const f = Math.max(0, Math.min(1, fraction));
  const { points, cumulativeKm: cum, lengthKm } = geo;
  if (points.length < 2 || lengthKm <= 0) {
    const only = points[0]!;
    return { lat: only.lat, lng: only.lng, headingDeg: 0, fraction: f };
  }
  const target = f * lengthKm;
  // Find the span [i, i+1] containing the target distance.
  let i = 0;
  while (i < cum.length - 2 && cum[i + 1]! < target) i++;
  const a = points[i]!;
  const b = points[i + 1]!;
  const spanKm = cum[i + 1]! - cum[i]!;
  const local = spanKm <= 0 ? 0 : (target - cum[i]!) / spanKm;
  return {
    lat: a.lat + (b.lat - a.lat) * local,
    lng: a.lng + (b.lng - a.lng) * local,
    headingDeg: bearingDeg(a, b),
    fraction: f,
  };
}

/**
 * Split a route into the polyline traveled up to `fraction` and the
 * polyline still remaining. Used to paint the "behind the marker" trail
 * solid and the "ahead" path dashed — the cinematic command-center read.
 * Both halves share the split point so they join seamlessly.
 */
export function splitRoute(
  geo: RouteGeometry,
  fraction: number,
): { traveled: RoutePoint[]; remaining: RoutePoint[] } {
  const f = Math.max(0, Math.min(1, fraction));
  const { points, cumulativeKm: cum, lengthKm } = geo;
  if (points.length < 2 || lengthKm <= 0) {
    return { traveled: [...points], remaining: [...points] };
  }
  const target = f * lengthKm;
  const traveled: RoutePoint[] = [points[0]!];
  let i = 0;
  for (; i < cum.length - 1; i++) {
    if (cum[i + 1]! >= target) break;
    traveled.push(points[i + 1]!);
  }
  const a = points[i]!;
  const b = points[Math.min(i + 1, points.length - 1)]!;
  const spanKm = cum[Math.min(i + 1, cum.length - 1)]! - cum[i]!;
  const local = spanKm <= 0 ? 0 : (target - cum[i]!) / spanKm;
  const splitPt: RoutePoint = {
    lat: a.lat + (b.lat - a.lat) * local,
    lng: a.lng + (b.lng - a.lng) * local,
  };
  traveled.push(splitPt);
  const remaining: RoutePoint[] = [splitPt, ...points.slice(i + 1)];
  return { traveled, remaining };
}
