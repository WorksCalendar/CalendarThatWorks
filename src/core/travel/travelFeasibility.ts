/**
 * Mode-aware travel feasibility — the multi-mode sibling of the engine's
 * `evaluateGeoConflicts`.
 *
 * The engine's `geo-travel-feasibility` rule asks "given one max speed,
 * is there enough of a gap to physically get between these two events?".
 * This clones that exact shape and semantics (same coord resolution, same
 * signed-gap math, same "overlap is resource-overlap territory, not ours"
 * carve-out) but swaps the single `maxSpeedKph` for a full `TravelProfile`
 * — so the resource scheduler can ask the same question per car, walking,
 * or aircraft performance profile.
 *
 * Reuses the engine's `GeoEventInput` shape verbatim so a host already
 * feeding `evaluateGeoConflicts` can point the same events at this with no
 * translation layer.
 */
import { haversineKm, type GeoEventInput, type LatLon } from 'works-calendar-engine';
import {
  estimateTravelMinutes,
  resolveTravelProfile,
  type TravelMode,
  type TravelProfile,
} from './travelProfiles';

export interface TravelFeasibilityRule {
  readonly id: string;
  readonly type: 'travel-feasibility';
  /** The mode/profile this rule reasons about. */
  readonly profile: TravelProfile;
  /** Defaults to `'soft'`, matching `geo-travel-feasibility`. */
  readonly severity?: 'soft' | 'hard';
  /** Minimum gap to enforce regardless of distance (turnaround/handoff). */
  readonly minGapMinutes?: number;
  /** Skip the rule when the proposed event's category is in this list. */
  readonly ignoreCategories?: readonly string[];
}

export interface TravelFeasibilityViolation {
  readonly rule: string;
  readonly severity: 'soft' | 'hard';
  readonly message: string;
  readonly conflictingEventId: string;
  readonly details: {
    readonly type: 'travel-feasibility';
    readonly mode: TravelMode;
    readonly profileLabel: string;
    readonly distanceKm: number;
    readonly requiredGapMinutes: number;
    readonly actualGapMinutes: number;
  };
}

/**
 * Convenience: build a `TravelFeasibilityRule` from a loose mode string
 * (e.g. `'car'`, `'turboprop'`). Mirrors the ergonomics of constructing a
 * `geo-travel-feasibility` rule inline.
 */
export function travelFeasibilityRule(
  id: string,
  mode: string,
  opts: Omit<TravelFeasibilityRule, 'id' | 'type' | 'profile'> = {},
): TravelFeasibilityRule {
  return { id, type: 'travel-feasibility', profile: resolveTravelProfile(mode), ...opts };
}

/**
 * Evaluate travel feasibility for a proposed event against others on the
 * same resource. Signature and return shape mirror `evaluateGeoConflicts`.
 */
export function evaluateTravelFeasibility(
  rules: readonly TravelFeasibilityRule[],
  proposed: GeoEventInput,
  others: readonly GeoEventInput[],
): readonly TravelFeasibilityViolation[] {
  if (rules.length === 0) return [];
  const proposedCoords = readCoords(proposed);
  if (!proposedCoords) return [];

  const violations: TravelFeasibilityViolation[] = [];
  for (const rule of rules) {
    if (
      rule.ignoreCategories &&
      proposed.category &&
      rule.ignoreCategories.includes(proposed.category)
    ) {
      continue;
    }
    for (const other of others) {
      if (other.id === proposed.id) continue;
      if (other.resource == null || proposed.resource == null) continue;
      if (other.resource !== proposed.resource) continue;
      const v = evaluateOne(rule, proposed, proposedCoords, other);
      if (v) violations.push(v);
    }
  }
  return violations;
}

function evaluateOne(
  rule: TravelFeasibilityRule,
  proposed: GeoEventInput,
  proposedCoords: LatLon,
  other: GeoEventInput,
): TravelFeasibilityViolation | null {
  const otherCoords = readCoords(other);
  if (!otherCoords) return null;

  const travelMinutes = estimateTravelMinutes(proposedCoords, otherCoords, rule.profile);
  const minGapMinutes = rule.minGapMinutes ?? 0;
  const requiredGapMinutes = Math.max(travelMinutes, minGapMinutes);
  if (!Number.isFinite(requiredGapMinutes) || requiredGapMinutes <= 0) return null;

  const gapMinutes = signedGapMinutes(proposed, other);
  if (gapMinutes === null) return null;
  // Negative gap = events overlap in time; that's resource-overlap's job.
  if (gapMinutes < 0) return null;
  if (gapMinutes >= requiredGapMinutes) return null;

  const distanceKm = haversineKm(proposedCoords, otherCoords);

  return {
    rule: rule.id,
    severity: rule.severity ?? 'soft',
    message:
      `Travel infeasible by ${rule.profile.label.toLowerCase()}: ` +
      `${distanceKm.toFixed(0)} km in ${gapMinutes.toFixed(0)} min ` +
      `(needs ≥${requiredGapMinutes.toFixed(0)} min).`,
    conflictingEventId: other.id,
    details: {
      type: 'travel-feasibility',
      mode: rule.profile.mode,
      profileLabel: rule.profile.label,
      distanceKm,
      requiredGapMinutes,
      actualGapMinutes: gapMinutes,
    },
  };
}

// ─── Helpers (cloned from the engine's geo evaluator) ─────────────────────────

function signedGapMinutes(a: GeoEventInput, b: GeoEventInput): number | null {
  const aStart = toEpochMs(a.start);
  const aEnd = toEpochMs(a.end);
  const bStart = toEpochMs(b.start);
  const bEnd = toEpochMs(b.end);
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return null;
  if (aEnd <= bStart) return (bStart - aEnd) / 60_000;
  if (bEnd <= aStart) return (aStart - bEnd) / 60_000;
  return -(Math.min(aEnd, bEnd) - Math.max(aStart, bStart)) / 60_000;
}

function toEpochMs(value: Date | string | number): number | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

function readCoords(ev: GeoEventInput): LatLon | null {
  const meta = ev.meta;
  if (!meta) return null;
  const direct = meta['coords'];
  if (direct && typeof direct === 'object') {
    const c = direct as Record<string, unknown>;
    const lat = c['lat'];
    const lon = c['lon'] ?? c['lng'];
    if (typeof lat === 'number' && typeof lon === 'number' && finitePair(lat, lon)) {
      return { lat, lon };
    }
  }
  const lat = meta['lat'];
  const lon = meta['lon'] ?? meta['lng'];
  if (typeof lat === 'number' && typeof lon === 'number' && finitePair(lat, lon)) {
    return { lat, lon };
  }
  return null;
}

function finitePair(a: number, b: number): boolean {
  return Number.isFinite(a) && Number.isFinite(b);
}
