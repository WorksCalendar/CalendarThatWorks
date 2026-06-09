import { describe, it, expect } from 'vitest';
import {
  estimateTravelMinutes,
  effectiveSpeedKph,
  resolveTravelProfile,
  CAR_PROFILE,
  WALKING_PROFILE,
  AIRLINER,
  LIGHT_PISTON,
  AIRCRAFT_PROFILES,
  TRAVEL_PROFILE_BY_MODE,
} from '../travelProfiles';
import { haversineKm, type LatLon } from 'works-calendar-engine';

// SEA ↔ DEN ≈ 1644 km; a 1 km hop for short-leg behavior.
const SEA: LatLon = { lat: 47.45, lon: -122.31 };
const DEN: LatLon = { lat: 39.86, lon: -104.67 };
const NEAR_SEA: LatLon = { lat: 47.46, lon: -122.31 }; // ~1.1 km north

describe('resolveTravelProfile', () => {
  it('maps mode strings to the right preset', () => {
    expect(resolveTravelProfile('car')).toBe(CAR_PROFILE);
    expect(resolveTravelProfile('walking')).toBe(WALKING_PROFILE);
    expect(resolveTravelProfile('aircraft')).toBe(TRAVEL_PROFILE_BY_MODE.aircraft);
  });

  it('resolves aircraft profile ids', () => {
    expect(resolveTravelProfile('turboprop')).toBe(AIRCRAFT_PROFILES.turboprop);
    expect(resolveTravelProfile('light-piston')).toBe(LIGHT_PISTON);
  });

  it('falls back to car for unknown/empty', () => {
    expect(resolveTravelProfile(undefined)).toBe(CAR_PROFILE);
    expect(resolveTravelProfile('')).toBe(CAR_PROFILE);
    expect(resolveTravelProfile('teleport')).toBe(CAR_PROFILE);
  });
});

describe('estimateTravelMinutes — surface modes', () => {
  it('walking is much slower than driving for the same leg', () => {
    const car = estimateTravelMinutes(SEA, DEN, CAR_PROFILE);
    const walk = estimateTravelMinutes(SEA, DEN, WALKING_PROFILE);
    expect(walk).toBeGreaterThan(car * 5);
  });

  it('car applies route factor + fixed overhead', () => {
    const km = haversineKm(SEA, DEN);
    const expected = (km * CAR_PROFILE.routeFactor) / CAR_PROFILE.averageKph * 60 +
      CAR_PROFILE.fixedOverheadMinutes;
    expect(estimateTravelMinutes(SEA, DEN, CAR_PROFILE)).toBeCloseTo(expected, 5);
  });

  it('walking has zero fixed overhead', () => {
    const km = haversineKm(SEA, DEN);
    const expected = (km * WALKING_PROFILE.routeFactor) / WALKING_PROFILE.averageKph * 60;
    expect(estimateTravelMinutes(SEA, DEN, WALKING_PROFILE)).toBeCloseTo(expected, 5);
  });
});

describe('estimateTravelMinutes — aircraft performance profile', () => {
  it('includes taxi overhead even for a near-zero leg', () => {
    const minutes = estimateTravelMinutes(SEA, SEA, AIRLINER);
    expect(minutes).toBeCloseTo(AIRLINER.taxiOutMinutes + AIRLINER.taxiInMinutes, 5);
  });

  it('a short hop never reaches cruise → effective speed well below cruise', () => {
    // ~1.1 km leg. Effective speed should be a tiny fraction of cruise
    // because taxi dominates and only climb/descent speeds apply.
    const eff = effectiveSpeedKph(SEA, NEAR_SEA, AIRLINER);
    expect(eff).toBeGreaterThan(0);
    expect(eff).toBeLessThan(AIRLINER.cruiseKph / 4);
  });

  it('a long haul approaches cruise speed', () => {
    const far: LatLon = { lat: 47.45, lon: -10 }; // very long leg from SEA
    const eff = effectiveSpeedKph(SEA, far, AIRLINER);
    expect(eff).toBeGreaterThan(AIRLINER.cruiseKph * 0.7);
    expect(eff).toBeLessThanOrEqual(AIRLINER.cruiseKph);
  });

  it('a jet is faster than a light piston over the same leg', () => {
    const jet = estimateTravelMinutes(SEA, DEN, AIRLINER);
    const piston = estimateTravelMinutes(SEA, DEN, LIGHT_PISTON);
    expect(jet).toBeLessThan(piston);
  });

  it('all three modes order as walking > car > aircraft for a long leg', () => {
    const walk = estimateTravelMinutes(SEA, DEN, WALKING_PROFILE);
    const car = estimateTravelMinutes(SEA, DEN, CAR_PROFILE);
    const air = estimateTravelMinutes(SEA, DEN, AIRLINER);
    expect(walk).toBeGreaterThan(car);
    expect(car).toBeGreaterThan(air);
  });
});

describe('effectiveSpeedKph edge cases', () => {
  it('returns 0 for a zero-distance leg', () => {
    expect(effectiveSpeedKph(SEA, SEA, CAR_PROFILE)).toBe(0);
  });
});
