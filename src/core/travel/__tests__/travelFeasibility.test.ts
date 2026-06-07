import { describe, it, expect } from 'vitest';
import {
  evaluateTravelFeasibility,
  travelFeasibilityRule,
  type TravelFeasibilityRule,
} from '../travelFeasibility';
import type { GeoEventInput } from 'works-calendar-engine';

const SEA = { lat: 47.45, lon: -122.31 };
const DEN = { lat: 39.86, lon: -104.67 }; // ~1644 km from SEA
const NEAR_SEA = { lat: 47.5, lon: -122.31 }; // ~5.6 km from SEA

function evt(
  id: string,
  start: string,
  end: string,
  resource: string | null,
  coords: { lat: number; lon: number } | null,
  category?: string,
): GeoEventInput {
  return {
    id,
    start,
    end,
    resource,
    ...(category ? { category } : {}),
    meta: coords ? { coords } : {},
  };
}

const CAR_RULE = travelFeasibilityRule('car', 'car');
const AIR_RULE = travelFeasibilityRule('air', 'airliner');

describe('evaluateTravelFeasibility', () => {
  it('flags a leg that is too short to drive', () => {
    const proposed = evt('p', '2026-04-20T12:00', '2026-04-20T13:00', 'rig-1', SEA);
    const other = evt('o', '2026-04-20T13:30', '2026-04-20T14:30', 'rig-1', DEN);
    const v = evaluateTravelFeasibility([CAR_RULE], proposed, [other]);
    expect(v.length).toBe(1);
    expect(v[0]!.details.mode).toBe('car');
    expect(v[0]!.details.distanceKm).toBeGreaterThan(1500);
    expect(v[0]!.details.actualGapMinutes).toBe(30);
    // 1644 km * 1.3 / 90 kph ≈ 1424 min required
    expect(v[0]!.details.requiredGapMinutes).toBeGreaterThan(1000);
  });

  it('the same leg is feasible by air with the same gap', () => {
    // 6h gap — too short to drive 1644 km, fine for an airliner.
    const proposed = evt('p', '2026-04-20T12:00', '2026-04-20T13:00', 'tail-1', SEA);
    const other = evt('o', '2026-04-20T19:00', '2026-04-20T20:00', 'tail-1', DEN);
    expect(evaluateTravelFeasibility([AIR_RULE], proposed, [other])).toEqual([]);
    // ...but driving it in 6h is still infeasible:
    const drivingProposed = { ...proposed, resource: 'rig-1' };
    const drivingOther = { ...other, resource: 'rig-1' };
    expect(
      evaluateTravelFeasibility([CAR_RULE], drivingProposed, [drivingOther]).length,
    ).toBe(1);
  });

  it('passes when the gap comfortably exceeds travel time', () => {
    const proposed = evt('p', '2026-04-20T12:00', '2026-04-20T13:00', 'rig-1', SEA);
    const other = evt('o', '2026-04-22T00:00', '2026-04-22T01:00', 'rig-1', DEN);
    expect(evaluateTravelFeasibility([CAR_RULE], proposed, [other])).toEqual([]);
  });

  it('does not fire when events overlap in time (resource-overlap territory)', () => {
    const proposed = evt('p', '2026-04-20T12:00', '2026-04-20T18:00', 'rig-1', SEA);
    const other = evt('o', '2026-04-20T14:00', '2026-04-20T20:00', 'rig-1', DEN);
    expect(evaluateTravelFeasibility([CAR_RULE], proposed, [other])).toEqual([]);
  });

  it('honors minGapMinutes (turnaround) even at zero distance', () => {
    const rule = travelFeasibilityRule('turn', 'aircraft', { minGapMinutes: 45 });
    const proposed = evt('p', '2026-04-20T12:00', '2026-04-20T13:00', 'tail-1', SEA);
    const other = evt('o', '2026-04-20T13:10', '2026-04-20T14:00', 'tail-1', SEA);
    const v = evaluateTravelFeasibility([rule], proposed, [other]);
    expect(v.length).toBe(1);
    expect(v[0]!.details.requiredGapMinutes).toBe(45);
    expect(v[0]!.details.actualGapMinutes).toBe(10);
  });

  it('skips events on a different resource', () => {
    const proposed = evt('p', '2026-04-20T12:00', '2026-04-20T13:00', 'rig-1', SEA);
    const other = evt('o', '2026-04-20T13:30', '2026-04-20T14:30', 'rig-2', DEN);
    expect(evaluateTravelFeasibility([CAR_RULE], proposed, [other])).toEqual([]);
  });

  it('skips self', () => {
    const proposed = evt('same', '2026-04-20T12:00', '2026-04-20T13:00', 'rig-1', SEA);
    const other = evt('same', '2026-04-20T13:30', '2026-04-20T14:30', 'rig-1', DEN);
    expect(evaluateTravelFeasibility([CAR_RULE], proposed, [other])).toEqual([]);
  });

  it('skips when either resource is null', () => {
    const proposed = evt('p', '2026-04-20T12:00', '2026-04-20T13:00', null, SEA);
    const other = evt('o', '2026-04-20T13:30', '2026-04-20T14:30', 'rig-1', DEN);
    expect(evaluateTravelFeasibility([CAR_RULE], proposed, [other])).toEqual([]);
  });

  it('skips when proposed has no coordinates', () => {
    const proposed = evt('p', '2026-04-20T12:00', '2026-04-20T13:00', 'rig-1', null);
    const other = evt('o', '2026-04-20T13:30', '2026-04-20T14:30', 'rig-1', DEN);
    expect(evaluateTravelFeasibility([CAR_RULE], proposed, [other])).toEqual([]);
  });

  it('skips when other has no coordinates', () => {
    const proposed = evt('p', '2026-04-20T12:00', '2026-04-20T13:00', 'rig-1', SEA);
    const other = evt('o', '2026-04-20T13:30', '2026-04-20T14:30', 'rig-1', null);
    expect(evaluateTravelFeasibility([CAR_RULE], proposed, [other])).toEqual([]);
  });

  it('respects ignoreCategories', () => {
    const rule: TravelFeasibilityRule = { ...CAR_RULE, ignoreCategories: ['ferry'] };
    const proposed = evt('p', '2026-04-20T12:00', '2026-04-20T13:00', 'rig-1', SEA, 'ferry');
    const other = evt('o', '2026-04-20T13:30', '2026-04-20T14:30', 'rig-1', DEN);
    expect(evaluateTravelFeasibility([rule], proposed, [other])).toEqual([]);
  });

  it('returns empty when rules is empty', () => {
    const proposed = evt('p', '2026-04-20T12:00', '2026-04-20T13:00', 'rig-1', SEA);
    const other = evt('o', '2026-04-20T13:30', '2026-04-20T14:30', 'rig-1', DEN);
    expect(evaluateTravelFeasibility([], proposed, [other])).toEqual([]);
  });

  it('uses hard severity when the rule specifies it', () => {
    const rule = travelFeasibilityRule('car-hard', 'car', { severity: 'hard' });
    const proposed = evt('p', '2026-04-20T12:00', '2026-04-20T13:00', 'rig-1', SEA);
    const other = evt('o', '2026-04-20T13:30', '2026-04-20T14:30', 'rig-1', DEN);
    const v = evaluateTravelFeasibility([rule], proposed, [other]);
    expect(v[0]!.severity).toBe('hard');
  });

  it('a short walkable leg with a tight gap is flagged for walking but not for car', () => {
    // ~5.6 km. Walking ≈ 67 min; a 20 min gap fails walking, passes car.
    const proposed = evt('p', '2026-04-20T12:00', '2026-04-20T13:00', 'crew-1', SEA);
    const other = evt('o', '2026-04-20T13:20', '2026-04-20T14:00', 'crew-1', NEAR_SEA);
    const walk = travelFeasibilityRule('walk', 'walking');
    expect(evaluateTravelFeasibility([walk], proposed, [other]).length).toBe(1);
    expect(evaluateTravelFeasibility([CAR_RULE], proposed, [other])).toEqual([]);
  });

  it('resolves coords from direct meta.lat/lng', () => {
    const proposed: GeoEventInput = {
      id: 'p', start: '2026-04-20T12:00', end: '2026-04-20T13:00', resource: 'rig-1',
      meta: { lat: SEA.lat, lng: SEA.lon },
    };
    const other: GeoEventInput = {
      id: 'o', start: '2026-04-20T13:30', end: '2026-04-20T14:30', resource: 'rig-1',
      meta: { lat: DEN.lat, lng: DEN.lon },
    };
    expect(evaluateTravelFeasibility([CAR_RULE], proposed, [other]).length).toBe(1);
  });

  it('returns no violation on an unparseable timestamp', () => {
    const proposed: GeoEventInput = {
      id: 'p', start: 'not-a-date', end: '2026-04-20T13:00', resource: 'rig-1',
      meta: { coords: SEA },
    };
    const other = evt('o', '2026-04-20T13:30', '2026-04-20T14:30', 'rig-1', DEN);
    expect(evaluateTravelFeasibility([CAR_RULE], proposed, [other])).toEqual([]);
  });
});
