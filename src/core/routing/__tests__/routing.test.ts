import { describe, it, expect } from 'vitest';
import {
  segmentKm,
  bearingDeg,
  cumulativeKm,
  buildGeometry,
  catmullRom,
  sampleRoute,
  splitRoute,
  resolveAssetDomain,
  basicRouteEngine,
  type RoutePoint,
} from '../index';

const PHX: RoutePoint = { lat: 33.45, lng: -112.07 };
const ELP: RoutePoint = { lat: 31.76, lng: -106.49 }; // ~580 km ESE of PHX

describe('geometry — distance + bearing', () => {
  it('segmentKm matches the great-circle distance', () => {
    const km = segmentKm(PHX, ELP);
    expect(km).toBeGreaterThan(500);
    expect(km).toBeLessThan(650);
  });

  it('segmentKm is 0 for identical points', () => {
    expect(segmentKm(PHX, PHX)).toBe(0);
  });

  it('bearingDeg points east for a due-east leg', () => {
    const b = bearingDeg({ lat: 0, lng: 0 }, { lat: 0, lng: 10 });
    expect(b).toBeGreaterThan(89);
    expect(b).toBeLessThan(91);
  });

  it('bearingDeg points north for a due-north leg', () => {
    const b = bearingDeg({ lat: 0, lng: 0 }, { lat: 10, lng: 0 });
    expect(b).toBeCloseTo(0, 1);
  });
});

describe('cumulativeKm', () => {
  it('starts at 0 and increases monotonically', () => {
    const cum = cumulativeKm([PHX, { lat: 32.2, lng: -110.9 }, ELP]);
    expect(cum[0]).toBe(0);
    expect(cum[1]!).toBeGreaterThan(0);
    expect(cum[2]!).toBeGreaterThan(cum[1]!);
  });
});

describe('buildGeometry', () => {
  it('dedupes adjacent identical points and reports length', () => {
    const geo = buildGeometry([PHX, PHX, ELP], 'ground', 'synthetic');
    expect(geo.points.length).toBe(2);
    expect(geo.lengthKm).toBeGreaterThan(500);
    expect(geo.cumulativeKm[0]).toBe(0);
  });

  it('guarantees at least two points from garbage input', () => {
    const geo = buildGeometry([{ lat: NaN, lng: NaN }], 'ground', 'synthetic');
    expect(geo.points.length).toBeGreaterThanOrEqual(2);
    expect(geo.lengthKm).toBe(0);
  });
});

describe('catmullRom', () => {
  it('returns the endpoints unchanged for a 2-point line', () => {
    const out = catmullRom([PHX, ELP], 10);
    expect(out).toHaveLength(2);
  });

  it('densifies and passes through both endpoints', () => {
    const mid: RoutePoint = { lat: 32.2, lng: -110.9 };
    const out = catmullRom([PHX, mid, ELP], 8);
    expect(out.length).toBeGreaterThan(3);
    expect(out[0]).toEqual(PHX);
    expect(out[out.length - 1]).toEqual(ELP);
  });
});

describe('sampleRoute', () => {
  const geo = buildGeometry([PHX, { lat: 32.2, lng: -110.9 }, ELP], 'ground', 'synthetic');

  it('returns the start at fraction 0 and the end at fraction 1', () => {
    const s0 = sampleRoute(geo, 0);
    const s1 = sampleRoute(geo, 1);
    expect(s0.lat).toBeCloseTo(PHX.lat, 5);
    expect(s0.lng).toBeCloseTo(PHX.lng, 5);
    expect(s1.lat).toBeCloseTo(ELP.lat, 5);
    expect(s1.lng).toBeCloseTo(ELP.lng, 5);
  });

  it('clamps out-of-range fractions and reports a finite heading', () => {
    const s = sampleRoute(geo, 1.5);
    expect(s.fraction).toBe(1);
    expect(Number.isFinite(s.headingDeg)).toBe(true);
  });

  it('lands roughly midway by distance at fraction 0.5', () => {
    const s = sampleRoute(geo, 0.5);
    // Between PHX and ELP latitudes.
    expect(s.lat).toBeLessThan(PHX.lat);
    expect(s.lat).toBeGreaterThan(ELP.lat);
  });
});

describe('splitRoute', () => {
  const geo = buildGeometry([PHX, { lat: 32.2, lng: -110.9 }, ELP], 'ground', 'synthetic');

  it('joins traveled and remaining at a shared split point', () => {
    const { traveled, remaining } = splitRoute(geo, 0.5);
    const tail = traveled[traveled.length - 1]!;
    const head = remaining[0]!;
    expect(tail.lat).toBeCloseTo(head.lat, 6);
    expect(tail.lng).toBeCloseTo(head.lng, 6);
  });

  it('puts everything ahead at fraction 0', () => {
    const { traveled } = splitRoute(geo, 0);
    // Traveled collapses to the origin.
    expect(traveled[0]!.lat).toBeCloseTo(PHX.lat, 6);
    expect(traveled[traveled.length - 1]!.lat).toBeCloseTo(PHX.lat, 4);
  });
});

describe('resolveAssetDomain', () => {
  it('maps surface modes to ground', () => {
    expect(resolveAssetDomain('car')).toBe('ground');
    expect(resolveAssetDomain('walking')).toBe('ground');
    expect(resolveAssetDomain(undefined)).toBe('ground');
    expect(resolveAssetDomain('forklift')).toBe('ground');
  });

  it('maps aircraft profiles + air keywords to air', () => {
    expect(resolveAssetDomain('aircraft')).toBe('air');
    expect(resolveAssetDomain('turboprop')).toBe('air');
    expect(resolveAssetDomain('Helicopter')).toBe('air');
  });

  it('maps vessel keywords to sea', () => {
    expect(resolveAssetDomain('ship')).toBe('sea');
    expect(resolveAssetDomain('ferry')).toBe('sea');
    expect(resolveAssetDomain('VESSEL')).toBe('sea');
  });
});

describe('basicRouteEngine', () => {
  it('synthesizes a curved ground path with no anchors', () => {
    const geo = basicRouteEngine.resolveRoute({ from: PHX, to: ELP, domain: 'ground' });
    expect(geo.source).toBe('synthetic');
    expect(geo.points.length).toBeGreaterThan(2);
    // A bowed path is longer than the straight chord.
    expect(geo.lengthKm).toBeGreaterThan(segmentKm(PHX, ELP));
  });

  it('traces host anchors when supplied', () => {
    const anchor: RoutePoint = { lat: 32.2, lng: -110.9 };
    const geo = basicRouteEngine.resolveRoute({
      from: PHX,
      to: ELP,
      domain: 'ground',
      anchors: [anchor],
    });
    expect(geo.source).toBe('anchors');
    expect(geo.points[0]).toEqual(PHX);
    expect(geo.points[geo.points.length - 1]).toEqual(ELP);
  });

  it('is deterministic — same request, same geometry', () => {
    const a = basicRouteEngine.resolveRoute({ from: PHX, to: ELP, domain: 'ground' });
    const b = basicRouteEngine.resolveRoute({ from: PHX, to: ELP, domain: 'ground' });
    expect(a.points).toEqual(b.points);
  });

  it('returns a stub for a degenerate (same-point) leg', () => {
    const geo = basicRouteEngine.resolveRoute({ from: PHX, to: PHX, domain: 'ground' });
    expect(geo.lengthKm).toBe(0);
    expect(geo.points.length).toBeGreaterThanOrEqual(2);
  });

  it('arcs air legs', () => {
    const geo = basicRouteEngine.resolveRoute({ from: PHX, to: ELP, domain: 'air' });
    expect(geo.domain).toBe('air');
    expect(geo.points.length).toBeGreaterThan(2);
  });
});
