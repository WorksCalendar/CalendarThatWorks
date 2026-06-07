/**
 * Travel-mode "time to arrive" profiles.
 *
 * The engine ships a single-speed travel model (`geo-travel-feasibility`,
 * see `Conflicts.md`): straight-line distance ÷ one `maxSpeedKph` → travel
 * minutes. That's enough to flag "this jet can't be in two cities an hour
 * apart", but it can't tell a dispatcher how long the *same* leg takes by
 * car versus on foot versus in a Caravan, and it badly overestimates the
 * speed of a short flight (where taxi, climb, and descent dominate and the
 * aircraft never reaches cruise).
 *
 * This module clones that maps-style "time to arrive" math and grows it
 * into three modes the resource scheduler actually dispatches with:
 *
 *   - `car`     — road travel: cruise speed + a route-winding factor +
 *                 a fixed parking/access overhead.
 *   - `walking` — same shape as car, slower, with a gentler path factor.
 *   - `aircraft`— a phase-based performance profile (taxi → climb →
 *                 cruise → descent → taxi). Short hops are split between
 *                 climb and descent and never credit cruise speed, which
 *                 is the whole reason a single `maxSpeedKph` is wrong for
 *                 aviation.
 *
 * Pure functions, no React, no network — the same posture as the engine's
 * geo helpers it builds on (`haversineKm`).
 */
import { haversineKm, type LatLon } from 'works-calendar-engine';

export type TravelMode = 'car' | 'walking' | 'aircraft';

/**
 * Surface travel (car, walking). Distance is the great-circle distance
 * scaled by `routeFactor` (real roads/paths are longer than a crow's
 * flight), divided by `averageKph`, plus a flat overhead for things that
 * don't scale with distance (parking, getting to the trailhead).
 */
export interface SurfaceTravelProfile {
  readonly mode: 'car' | 'walking';
  readonly label: string;
  /** Sustained average speed in km/h. */
  readonly averageKph: number;
  /** Multiplier applied to straight-line distance to approximate the
   *  real path. 1.0 = perfectly straight; ~1.3 is typical for roads. */
  readonly routeFactor: number;
  /** Flat minutes added regardless of distance (parking, access). */
  readonly fixedOverheadMinutes: number;
}

/**
 * Aircraft performance profile. Travel time is the sum of distinct flight
 * phases rather than one cruise speed, so a 50 km hop and a 5000 km haul
 * get realistically different effective speeds.
 *
 * The horizontal distance nominally spent climbing/descending is
 * `climbDistanceKm` / `descentDistanceKm`. Anything left over is flown at
 * `cruiseKph`. When the leg is shorter than climb + descent combined, the
 * whole distance is split between the two phases in proportion to their
 * nominal lengths and cruise is never reached.
 */
export interface AircraftPerformanceProfile {
  readonly mode: 'aircraft';
  readonly label: string;
  readonly cruiseKph: number;
  readonly climbKph: number;
  readonly descentKph: number;
  /** Horizontal distance covered while climbing to cruise altitude. */
  readonly climbDistanceKm: number;
  /** Horizontal distance covered while descending from cruise. */
  readonly descentDistanceKm: number;
  /** Taxi-out (gate → runway) minutes. */
  readonly taxiOutMinutes: number;
  /** Taxi-in (runway → gate) minutes. */
  readonly taxiInMinutes: number;
}

export type TravelProfile = SurfaceTravelProfile | AircraftPerformanceProfile;

// ─── Surface presets ────────────────────────────────────────────────────────

export const CAR_PROFILE: SurfaceTravelProfile = {
  mode: 'car',
  label: 'Car',
  averageKph: 90,
  routeFactor: 1.3,
  fixedOverheadMinutes: 5,
};

export const WALKING_PROFILE: SurfaceTravelProfile = {
  mode: 'walking',
  label: 'Walking',
  averageKph: 5,
  routeFactor: 1.2,
  fixedOverheadMinutes: 0,
};

// ─── Aircraft presets ─────────────────────────────────────────────────────────
//
// Round, defensible numbers for common categories. Hosts with real
// performance data should pass their own `AircraftPerformanceProfile`.

export const LIGHT_PISTON: AircraftPerformanceProfile = {
  mode: 'aircraft',
  label: 'Light piston',
  cruiseKph: 230,
  climbKph: 150,
  descentKph: 200,
  climbDistanceKm: 15,
  descentDistanceKm: 20,
  taxiOutMinutes: 8,
  taxiInMinutes: 5,
};

export const TURBOPROP: AircraftPerformanceProfile = {
  mode: 'aircraft',
  label: 'Turboprop',
  cruiseKph: 550,
  climbKph: 350,
  descentKph: 450,
  climbDistanceKm: 60,
  descentDistanceKm: 80,
  taxiOutMinutes: 10,
  taxiInMinutes: 6,
};

export const BUSINESS_JET: AircraftPerformanceProfile = {
  mode: 'aircraft',
  label: 'Business jet',
  cruiseKph: 800,
  climbKph: 500,
  descentKph: 650,
  climbDistanceKm: 120,
  descentDistanceKm: 150,
  taxiOutMinutes: 12,
  taxiInMinutes: 7,
};

export const AIRLINER: AircraftPerformanceProfile = {
  mode: 'aircraft',
  label: 'Airliner',
  cruiseKph: 880,
  climbKph: 550,
  descentKph: 700,
  climbDistanceKm: 200,
  descentDistanceKm: 250,
  taxiOutMinutes: 15,
  taxiInMinutes: 8,
};

/** Built-in aircraft profiles, keyed by a stable id for host pickers. */
export const AIRCRAFT_PROFILES = {
  'light-piston': LIGHT_PISTON,
  turboprop: TURBOPROP,
  'business-jet': BUSINESS_JET,
  airliner: AIRLINER,
} as const;

export type AircraftProfileId = keyof typeof AIRCRAFT_PROFILES;

/** Default aircraft profile when a mode is `aircraft` but no profile is named. */
export const DEFAULT_AIRCRAFT_PROFILE: AircraftPerformanceProfile = AIRLINER;

/** Default profile for each mode, used when only a mode (no full profile) is known. */
export const TRAVEL_PROFILE_BY_MODE: Readonly<Record<TravelMode, TravelProfile>> = {
  car: CAR_PROFILE,
  walking: WALKING_PROFILE,
  aircraft: DEFAULT_AIRCRAFT_PROFILE,
};

/**
 * Resolve a `TravelProfile` from a loose mode string (e.g. read off
 * `event.meta.travelMode`). Unknown / missing values fall back to `car`,
 * matching the most common dispatch default. An aircraft profile id
 * (`'turboprop'`, `'airliner'`, …) also resolves here.
 */
export function resolveTravelProfile(
  mode: string | null | undefined,
): TravelProfile {
  if (!mode) return CAR_PROFILE;
  if (mode in AIRCRAFT_PROFILES) {
    return AIRCRAFT_PROFILES[mode as AircraftProfileId];
  }
  if (mode === 'car' || mode === 'walking' || mode === 'aircraft') {
    return TRAVEL_PROFILE_BY_MODE[mode];
  }
  return CAR_PROFILE;
}

// ─── Estimation ───────────────────────────────────────────────────────────────

/** Minutes to cover `km` at `kph`. 0 km → 0; non-positive speed → Infinity. */
function legMinutes(km: number, kph: number): number {
  if (km <= 0) return 0;
  if (kph <= 0) return Infinity;
  return (km / kph) * 60;
}

function surfaceMinutes(greatCircleKm: number, p: SurfaceTravelProfile): number {
  const pathKm = greatCircleKm * p.routeFactor;
  return legMinutes(pathKm, p.averageKph) + p.fixedOverheadMinutes;
}

function aircraftMinutes(distanceKm: number, p: AircraftPerformanceProfile): number {
  const taxi = p.taxiOutMinutes + p.taxiInMinutes;
  const climbDescentKm = p.climbDistanceKm + p.descentDistanceKm;

  // Short hop: the leg is shorter than the nominal climb + descent, so the
  // aircraft never levels off at cruise. Split the distance between the two
  // phases in proportion to their nominal lengths.
  if (distanceKm <= climbDescentKm) {
    const totalNominal = climbDescentKm > 0 ? climbDescentKm : 1;
    const climbKm = distanceKm * (p.climbDistanceKm / totalNominal);
    const descentKm = distanceKm * (p.descentDistanceKm / totalNominal);
    return taxi + legMinutes(climbKm, p.climbKph) + legMinutes(descentKm, p.descentKph);
  }

  const cruiseKm = distanceKm - climbDescentKm;
  return (
    taxi +
    legMinutes(p.climbDistanceKm, p.climbKph) +
    legMinutes(cruiseKm, p.cruiseKph) +
    legMinutes(p.descentDistanceKm, p.descentKph)
  );
}

/**
 * Estimate "time to arrive" in minutes between two coordinates for a
 * given travel profile. Returns `Infinity` when the coordinates can't
 * yield a finite distance (the caller should treat that as "unknown").
 */
export function estimateTravelMinutes(
  from: LatLon,
  to: LatLon,
  profile: TravelProfile,
): number {
  const greatCircleKm = haversineKm(from, to);
  if (!Number.isFinite(greatCircleKm)) return Infinity;
  return profile.mode === 'aircraft'
    ? aircraftMinutes(greatCircleKm, profile)
    : surfaceMinutes(greatCircleKm, profile);
}

/**
 * Effective door-to-door average speed (km/h) for a profile over a given
 * straight-line distance. This is the bridge back to the engine's
 * single-speed `geo-travel-feasibility` rule: feed the result as
 * `maxSpeedKph` and the existing geo pipeline reproduces this profile's
 * timing for that leg. Returns 0 when the leg is degenerate.
 */
export function effectiveSpeedKph(
  from: LatLon,
  to: LatLon,
  profile: TravelProfile,
): number {
  const distanceKm = haversineKm(from, to);
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
  const minutes = estimateTravelMinutes(from, to, profile);
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return distanceKm / (minutes / 60);
}
