# Travel-mode "time to arrive"

The engine ships a single-speed travel model — the `geo-travel-feasibility`
rule (see [Conflicts.md](./Conflicts.md#geo-conflict-detection)) — that
divides the straight-line distance between two events by one `maxSpeedKph`
to decide whether a resource can physically make the trip in the available
gap.

That's enough to stop a jet from being booked in two cities an hour apart,
but the resource scheduler dispatches with mixed fleets that move very
differently. This module clones that maps-style "time to arrive" math and
grows it into three modes:

| Mode | Model |
| --- | --- |
| `car` | great-circle × route factor ÷ average speed + a flat access overhead |
| `walking` | same shape as car, slower, gentler path factor, no overhead |
| `aircraft` | phase-based performance profile: taxi → climb → cruise → descent → taxi |

The aircraft model is the reason a single `maxSpeedKph` isn't enough: a
50 km hop and a 5000 km haul get realistically different *effective* speeds
because taxi, climb, and descent dominate short legs and the aircraft never
reaches cruise.

## Estimating a leg

```ts
import {
  estimateTravelMinutes,
  CAR_PROFILE,
  WALKING_PROFILE,
  AIRLINER,
} from 'works-calendar';

const SEA = { lat: 47.45, lon: -122.31 };
const DEN = { lat: 39.86, lon: -104.67 }; // ~1644 km

estimateTravelMinutes(SEA, DEN, CAR_PROFILE);     // ≈ 1424 min (road + overhead)
estimateTravelMinutes(SEA, DEN, WALKING_PROFILE); // ≈ 23 700 min
estimateTravelMinutes(SEA, DEN, AIRLINER);        // ≈ 158 min (taxi + climb + cruise + descent + taxi)
```

`estimateTravelMinutes` returns `Infinity` when the coordinates can't yield
a finite distance — treat that as "unknown".

### Profiles

`CAR_PROFILE` and `WALKING_PROFILE` are `SurfaceTravelProfile`s. Aircraft
ship as `AircraftPerformanceProfile` presets — `LIGHT_PISTON`, `TURBOPROP`,
`BUSINESS_JET`, `AIRLINER` — also available by id in `AIRCRAFT_PROFILES`.
Pass your own profile object for real performance data.

`resolveTravelProfile(mode)` turns a loose string (`'car'`, `'walking'`,
`'aircraft'`, or an aircraft profile id like `'turboprop'`) into a profile,
falling back to `CAR_PROFILE` for anything unknown. This is what the
dispatch view uses to read `event.meta.travelMode` / `asset.meta.travelMode`.

## Feasibility checking

`evaluateTravelFeasibility` is the mode-aware sibling of
`evaluateGeoConflicts` — same signature, same coord resolution, same
"overlap is `resource-overlap`'s job, not ours" carve-out — but it reasons
about a full `TravelProfile` instead of one speed.

```ts
import { evaluateTravelFeasibility, travelFeasibilityRule } from 'works-calendar';

const rule = travelFeasibilityRule('truck-travel', 'car', { severity: 'soft' });

const violations = evaluateTravelFeasibility([rule], proposed, others);
// violations[0].details = { mode, profileLabel, distanceKm, requiredGapMinutes, actualGapMinutes }
```

Events use the engine's `GeoEventInput` shape (coordinates via
`meta.coords` `{ lat, lon }` or top-level `meta.lat/lon|lng`), so anything
already feeding `evaluateGeoConflicts` points here with no translation.

### Bridging back to the engine rule

`effectiveSpeedKph(from, to, profile)` returns the door-to-door average
speed a profile implies for a given leg. Feed it as `maxSpeedKph` on a
`geo-travel-feasibility` rule and the existing engine pipeline reproduces
this profile's timing for that leg.

## In the dispatch view

`deriveDispatchData(events, assets, defaultTravelMode = 'car')` annotates
each `DispatchSegment` with an `estimate` (`{ mode, profileLabel, minutes }`)
computed from the leg's distance and the resolved travel mode:

1. the departing stop's `event.meta.travelMode` (per-leg override), else
2. the asset's `meta.travelMode`, else
3. `defaultTravelMode`.

The dispatch time slider surfaces the estimate next to the scheduled clock
time ("… · 2h 30m drive · est 2h 38m by car") and in each leg's tooltip, so
a dispatcher can see at a glance whether a leg is padded or physically tight.

## References

- `src/core/travel/travelProfiles.ts` — profiles + estimator
- `src/core/travel/travelFeasibility.ts` — `evaluateTravelFeasibility`
- `src/views/dispatch/deriveData.ts` — segment estimate wiring
