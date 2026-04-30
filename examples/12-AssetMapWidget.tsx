/**
 * Example 12 — AssetMapWidget (optional integration)
 *
 * Shows the strict, map-agnostic situational-awareness overlay sitting
 * alongside `<WorksCalendar />`. The widget reads `AssetTrackerPosition`s
 * and renders one of three modes:
 *
 *   peek       a corner pill (asset count + stale dot)
 *   panel      a 360x280 floating card
 *   fullscreen a full-viewport ops map
 *
 * No MapLibre / Leaflet / Cesium required: this example uses the
 * dependency-free SVG fallback. To wire a real basemap, build an adapter
 * that satisfies `WorksCalendarMapAdapter` and pass it via the `adapter`
 * prop — see docs/AssetMapWidget.md for a MapLibre example.
 */
import { useMemo, useState } from 'react';
import { WorksCalendar } from '../src/index.ts';
import { AssetMapWidget } from '../src/integrations/asset-map-widget.tsx';
import type { AssetTrackerPosition } from '../src/integrations/asset-map-widget.tsx';

// ── Live position fixtures ────────────────────────────────────────────────────
// In a real deployment these come from your asset-tracking backend (push
// updates over a WebSocket, polling REST, MQTT, etc.). Here we stage a
// static snapshot — one stale entry to show the warning dot.
const NOW = Math.floor(Date.now() / 1000);

const POSITIONS: AssetTrackerPosition[] = [
  {
    id: 'ac-n801aw',
    label: 'AW139 N801AW',
    lat: 47.4502, lon: -122.3088,
    altitude: 1200, heading: 90, speed: 140,
    timestamp: NOW - 30,
    source: 'demo',
  },
  {
    id: 'ac-n804aw',
    label: 'AW139 N804AW',
    lat: 39.8561, lon: -104.6737,
    altitude: 6500, heading: 270, speed: 150,
    timestamp: NOW - 45,
    source: 'demo',
  },
  {
    id: 'ac-n805pc',
    label: 'PC-12 N805PC',
    lat: 40.7899, lon: -111.9791,
    altitude: 18000, heading: 45, speed: 240,
    timestamp: NOW - 600,            // ← stale (> 120s default)
    source: 'demo',
  },
];

// ── Calendar fixtures ─────────────────────────────────────────────────────────
const today = new Date();
const at = (h: number) => {
  const d = new Date(today); d.setHours(h, 0, 0, 0); return d;
};

const EVENTS = [
  { id: 'sea-1', title: 'SEA — Day shift',     start: at(7),  end: at(19), color: '#3b82f6' },
  { id: 'den-1', title: 'DEN — Inter-facility', start: at(10), end: at(14), color: '#10b981' },
];

const EMPLOYEES = [
  { id: 'emp-james', name: 'Capt. James Wright', role: 'Pilot' },
  { id: 'emp-keely', name: 'Keely Frost',        role: 'RN — Critical Care' },
];

export function AssetMapWidgetExample() {
  const [mode, setMode] = useState<'peek' | 'panel' | 'fullscreen'>('peek');

  const positions = useMemo(() => POSITIONS, []);

  return (
    <div style={{ position: 'relative', height: '100vh' }}>
      <WorksCalendar
        events={EVENTS}
        employees={EMPLOYEES}
        calendarId="example-12-asset-map-widget"
      />

      {/* The widget overlays in the chosen corner; it doesn't reflow the
          calendar so it works for any host layout. */}
      <AssetMapWidget
        positions={positions}
        position="top-right"
        initialMode={mode}
        onModeChange={setMode}
        title="Live fleet"
        // staleThresholdSeconds={300}  // override default of 120s
        // adapter={createMaplibreAdapter('https://tiles.openfreemap.org/styles/liberty')}
      />
    </div>
  );
}
