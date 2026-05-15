# Truck Demo Data — Stress Test Summary

## Scale
- **Trucks:** 30
- **Facilities:** 10 (Phoenix, Tucson, Albuquerque, El Paso, Las Vegas, Los Angeles, San Diego, Flagstaff, Barstow, Kingman)
- **Route Types:** hub_spoke, regional_loop, corridor, long_haul
- **Weeks:** 2
- **Total Route Segments:** 282
- **Total Stops:** 578

## Conflicts (Week 1)
- **Natural dock conflicts:** 65
- **Facilities with conflicts:** 10
- **Worst facility:** LAX

## Facility Breakdown
- **ABQ** (Albuquerque DC): 6 trucks based here, 5 conflicts
- **ELP** (El Paso Terminal): 3 trucks based here, 5 conflicts
- **LAS** (Las Vegas Hub): 3 trucks based here, 11 conflicts
- **LAX** (Los Angeles DC): 6 trucks based here, 13 conflicts
- **PHX** (Phoenix Distribution Center): 7 trucks based here, 12 conflicts
- **SAN** (San Diego Hub): 2 trucks based here, 4 conflicts
- **TUS** (Tucson Hub): 3 trucks based here, 5 conflicts

## Top Conflict Hotspots (Week 1)
- Los Angeles DC: 13 conflicts
- Phoenix Distribution Center: 12 conflicts
- Las Vegas Hub: 11 conflicts
- Albuquerque DC: 5 conflicts
- Tucson Hub: 5 conflicts

## Truck Breakdown by Type
- dry_van: 20
- reefer: 6
- flatbed: 4

## How to Use
```typescript
import { TRUCKS, FACILITIES, TRUCK_ROUTES, DOCK_CONFLICTS_WEEK1, buildEngineInit } from './truckDemoData';

// Initialize engine with all 30 trucks
const engine = new CalendarEngine(buildEngineInit());

// Check conflicts at a specific facility
const conflicts = DOCK_CONFLICTS_WEEK1.filter(c => c.facility === 'LAS');

// Get routes for one truck
const t001 = TRUCK_ROUTES.find(r => r.truck.id === 'T001' && r.weekIndex === 0);

// Render breadcrumbs
const segments = t001!.segments; // GeoJSON LineString sources
```
