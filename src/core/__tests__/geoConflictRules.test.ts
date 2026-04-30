import { describe, it, expect } from 'vitest'
import {
  evaluateGeoConflicts,
  type GeoTravelFeasibilityRule,
  type GeoEventInput,
} from '../conflicts/geoConflictRules'

const RULE: GeoTravelFeasibilityRule = {
  id: 'travel',
  type: 'geo-travel-feasibility',
  maxSpeedKph: 800,
}

// Coordinates: SEA (47.45, -122.31), DEN (39.86, -104.67) — ~1644 km
const SEA = { lat: 47.45, lon: -122.31 }
const DEN = { lat: 39.86, lon: -104.67 }

function evt(
  id: string,
  start: string,
  end: string,
  resource: string,
  coords: { lat: number; lon: number } | null,
): GeoEventInput {
  return { id, start, end, resource, meta: coords ? { coords } : {} }
}

describe('evaluateGeoConflicts — travel feasibility', () => {
  it('flags a gap that is too short for the distance', () => {
    const proposed = evt('p', '2026-04-20T12:00', '2026-04-20T13:00', 'ac-1', SEA)
    const other    = evt('o', '2026-04-20T13:30', '2026-04-20T14:30', 'ac-1', DEN)
    const v = evaluateGeoConflicts([RULE], proposed, [other])
    expect(v.length).toBe(1)
    expect(v[0]!.severity).toBe('soft')
    expect(v[0]!.details.distanceKm).toBeGreaterThan(1500)
    // 1644 km / 800 kph ≈ 123 min required, gap is 30 min
    expect(v[0]!.details.requiredGapMinutes).toBeGreaterThan(120)
    expect(v[0]!.details.actualGapMinutes).toBe(30)
  })

  it('passes when gap is comfortably above travel time', () => {
    const proposed = evt('p', '2026-04-20T12:00', '2026-04-20T13:00', 'ac-1', SEA)
    const other    = evt('o', '2026-04-21T00:00', '2026-04-21T01:00', 'ac-1', DEN)
    expect(evaluateGeoConflicts([RULE], proposed, [other])).toEqual([])
  })

  it('skips events on a different resource', () => {
    const proposed = evt('p', '2026-04-20T12:00', '2026-04-20T13:00', 'ac-1', SEA)
    const other    = evt('o', '2026-04-20T13:30', '2026-04-20T14:30', 'ac-2', DEN)
    expect(evaluateGeoConflicts([RULE], proposed, [other])).toEqual([])
  })

  it('does not fire when events overlap in time (resource-overlap territory)', () => {
    const proposed = evt('p', '2026-04-20T12:00', '2026-04-20T14:00', 'ac-1', SEA)
    const other    = evt('o', '2026-04-20T13:00', '2026-04-20T15:00', 'ac-1', DEN)
    expect(evaluateGeoConflicts([RULE], proposed, [other])).toEqual([])
  })

  it('honors minGapMinutes even when distance is zero', () => {
    const turnaround: GeoTravelFeasibilityRule = { ...RULE, minGapMinutes: 30 }
    const proposed = evt('p', '2026-04-20T12:00', '2026-04-20T13:00', 'ac-1', SEA)
    const other    = evt('o', '2026-04-20T13:10', '2026-04-20T14:00', 'ac-1', SEA)
    const v = evaluateGeoConflicts([turnaround], proposed, [other])
    expect(v.length).toBe(1)
    expect(v[0]!.details.requiredGapMinutes).toBe(30)
    expect(v[0]!.details.actualGapMinutes).toBe(10)
  })

  it('skips when proposed event has no coordinates', () => {
    const proposed = evt('p', '2026-04-20T12:00', '2026-04-20T13:00', 'ac-1', null)
    const other    = evt('o', '2026-04-20T13:30', '2026-04-20T14:30', 'ac-1', DEN)
    expect(evaluateGeoConflicts([RULE], proposed, [other])).toEqual([])
  })

  it('respects ignoreCategories', () => {
    const rule: GeoTravelFeasibilityRule = { ...RULE, ignoreCategories: ['ferry'] }
    const proposed = { ...evt('p', '2026-04-20T12:00', '2026-04-20T13:00', 'ac-1', SEA), category: 'ferry' }
    const other    = evt('o', '2026-04-20T13:30', '2026-04-20T14:30', 'ac-1', DEN)
    expect(evaluateGeoConflicts([rule], proposed, [other])).toEqual([])
  })
})
