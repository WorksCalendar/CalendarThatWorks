// @ts-nocheck — demo fixture with progressive typing work in progress
import { StrictMode, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import {
  WorksCalendar,
  type WorksCalendarEvent,
  DEFAULT_CATEGORIES,
  createManualLocationProvider,
} from '../src/index.ts';
import { safeGetLocalStorage, safeSetLocalStorage, safeRemoveLocalStorage, safeLocalStorageKeys } from '../src/core/safeLocalStorage';
import DemoErrorBoundary from './DemoErrorBoundary';
import { saveProfiles } from '../src/core/profileStore';
import { loadConfig, saveConfig, DEFAULT_CONFIG } from '../src/core/configSchema';
import { loadPools, savePools } from '../src/core/pools/poolStore';
import { buildDefaultFilterSchema } from '../src/filters/filterSchema';
import { CASCADE_FILTER_DEFINITIONS, buildDemoCascadeConfig } from './filterConfig';
import {
  regions,
  bases,
  assets as EMS_ASSETS,
  crew,
  dispatchers,
  medicalCrew,
  mechanics,
  allEvents,
  mission,
} from './emsData';
import MissionHoverCard, { allRequirementsMet } from './MissionHoverCard';
import missionStyles from './MissionHoverCard.module.css';
import { makeDispatchEvaluator } from './dispatchEvaluator';
import Landing from './Landing';
import DemoHoverCard from './DemoHoverCard';
import {
  DEFAULT_PROFILE_ID,
  findProfile,
  APPROVAL_ACTION_CAP,
} from './profiles';
import WalkthroughHost from './walkthrough/WalkthroughHost';
import { useWalkthrough } from './walkthrough/useWalkthrough';
import {
  ALPHA_INITIAL_START_ISO,
  CONFLICT_PILOT_ID,
  WALKTHROUGH_DECOY_SHIFT_ID,
  WALKTHROUGH_MISSION_ID,
  buildWalkthroughEvents,
} from './walkthrough/fixtures';

/* ─── Demo identity ─────────────────────────────────────────────── */
// Air EMS demo: new calendar id so the IHC Fleet localStorage doesn't bleed
// through. Returning users see a clean slate with Air EMS defaults.
const DEMO_CALENDAR_ID = 'air-ems-demo';
// Demo feature kill switches. Flip any flag to false (or set the matching
// VITE_ENABLE_DEMO_* env var to '0') to disable a surface without redeploying
// deeper app logic.
const DEMO_FEATURES = {
  walkthrough: import.meta.env.VITE_ENABLE_DEMO_WALKTHROUGH !== '0',
  missionHoverCard: import.meta.env.VITE_ENABLE_DEMO_MISSION_HOVERCARD !== '0',
  pwaRegistration: import.meta.env.VITE_ENABLE_DEMO_PWA !== '0',
  mapWidget: import.meta.env.VITE_ENABLE_DEMO_MAP_WIDGET !== '0',
  workflowBuilder: import.meta.env.VITE_ENABLE_DEMO_WORKFLOW_BUILDER !== '0',
} as const;

if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('resetDemo') === '1') {
  safeLocalStorageKeys()
    .filter((k) => k.startsWith('wc-'))
    .forEach((k) => { safeRemoveLocalStorage(k); });
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistrations().then((regs) => Promise.all(regs.map((r) => r.unregister())));
  }
}

/* ─── Profiles (saved filter sets in the profile bar) ──────────── */
// Sprint 3 (issue #268 Task 5): seed the 6 required operational saved
// views so the ProfileBar lights up with meaningful chips out of the
// box. The filter/grouping wiring is intentionally light-touch for now
// — each view sets category filters that match its label; the View-tab
// perspective preset does the heavy grouping lifting.
const DEMO_PROFILES = [
  { id: 'p-by-base',        name: 'By Base',              color: '#0ea5e9', filters: { categories: [],                                                    resources: [], search: '' }, view: 'base'     },
  { id: 'p-dispatch-board', name: 'Dispatch Board',       color: '#6366f1', filters: { categories: ['dispatch-shift'],                                    resources: [], search: '' }, view: 'schedule' },
  { id: 'p-maintenance',    name: 'Maintenance Coverage', color: '#f97316', filters: { categories: ['maintenance'],                                       resources: [], search: '' }, view: 'assets'   },
  { id: 'p-flight-crew',    name: 'Flight Crew',          color: '#3b82f6', filters: { categories: ['pilot-shift', 'medical-shift', 'mechanic-shift'],   resources: [], search: '' }, view: 'schedule' },
  { id: 'p-requests',       name: 'Requests',             color: '#10b981', filters: { categories: ['aircraft-request', 'asset-request'],                resources: [], search: '' }, view: 'agenda'   },
  { id: 'p-mission',        name: 'Mission Timeline',     color: '#a855f7', filters: { categories: ['mission-assignment'],                               resources: [], search: '' }, view: 'schedule' },
];
// Reseed profiles on first load AND when DEMO_SEED_VERSION bumps so
// returning visitors pick up new profile-list changes (like the Sprint 3
// rename from "Full Ops / Pilots / …" to the 6 issue-required views).
const storedProfiles = safeGetLocalStorage(`wc-profiles-${DEMO_CALENDAR_ID}`);
const storedProfileSeedVer = Number(safeGetLocalStorage(`wc-demo-profiles-v-${DEMO_CALENDAR_ID}`) ?? 0);
const PROFILES_SEED_VERSION = 3;
if (!storedProfiles || storedProfiles === '[]' || storedProfileSeedVer < PROFILES_SEED_VERSION) {
  saveProfiles(DEMO_CALENDAR_ID, DEMO_PROFILES);
  safeSetLocalStorage(`wc-demo-profiles-v-${DEMO_CALENDAR_ID}`, String(PROFILES_SEED_VERSION));
}

/* ─── Bases ─────────────────────────────────────────────────────── */
// Include regionId so BaseGanttView can group bases by region, and the
// Settings → Team tab can show / assign regions when editing bases.
const DEMO_BASES = bases.map(b => ({ id: b.id, name: b.name, regionId: b.regionId }));

/* ─── Geographic coordinates per base (for MapView) ─────────────── */
const BASE_COORDS: Record<string, { lat: number; lon: number }> = {
  'b-seattle':  { lat: 47.4502, lon: -122.3088 }, // SEA
  'b-portland': { lat: 45.5887, lon: -122.5975 }, // PDX
  'b-denver':   { lat: 39.8561, lon: -104.6737 }, // DEN
  'b-slc':      { lat: 40.7899, lon: -111.9791 }, // SLC
  'b-bozeman':  { lat: 45.7775, lon: -111.1602 }, // BZN
};

/* ─── Config seed ───────────────────────────────────────────────── */
// Bumped for the Air EMS identity change. Existing visitors on the IHC seed
// see the new defaults on their next load without a manual storage wipe.
//
// Seed v5 carries two upgrades:
//   1. Force-resync `team.bases` to DEMO_BASES. Earlier versions preserved
//      any non-empty `existing.team.bases`, leaving returning visitors with
//      stale base ids (e.g. IHC-era numeric ids) that no longer matched
//      employee `basedAt` / aircraft `meta.base`. The result was a By-Base
//      view counting 0 people / 0 assets at every base. Bases are demo-
//      controlled identity, not user data, so overwriting them is safe.
//   2. Default view returns to Month. The seed previously hard-coded
//      `defaultView: 'base'`; only the carried-over 'base' choice is reset
//      so any user-picked view is respected.
// v9: add 'dispatch' and 'requests' to enabledViews so both tabs appear in
//     the nav out of the box. The default schema only includes
//     ['day','agenda','schedule','base','assets'] — Dispatch was wired up with
//     dispatchMissions/dispatchEvaluator props but the tab never rendered
//     because it wasn't in enabledViews.
const DEMO_SEED_VERSION = 9;
const SEED_VER_KEY      = `wc-demo-seed-v-${DEMO_CALENDAR_ID}`;
const storedCfg         = safeGetLocalStorage(`wc-config-${DEMO_CALENDAR_ID}`);
const storedSeedVer     = Number(safeGetLocalStorage(SEED_VER_KEY) ?? 0);

// Seed the demo regions list (shared between the fresh-install and migration paths).
const DEMO_REGIONS = regions.map(r => ({ id: r.id, name: r.name }));

// Views the Air EMS demo needs visible from the start. Includes 'dispatch'
// and 'requests' which are not in DEFAULT_CONFIG.display.enabledViews.
const DEMO_ENABLED_VIEWS = [
  ...DEFAULT_CONFIG.display.enabledViews,
  'dispatch',
  'requests',
];

if (!storedCfg) {
  saveConfig(DEMO_CALENDAR_ID, {
    ...DEFAULT_CONFIG,
    title: 'Air EMS Operations',
    setup: { completed: true, preferredTheme: 'industrial-light' },
    display: { ...DEFAULT_CONFIG.display, enabledViews: DEMO_ENABLED_VIEWS },
    team: { ...DEFAULT_CONFIG.team, bases: DEMO_BASES, regions: DEMO_REGIONS },
    approvals: { ...DEFAULT_CONFIG.approvals, enabled: true },
  });
  safeSetLocalStorage(SEED_VER_KEY, String(DEMO_SEED_VERSION));
} else if (storedSeedVer < DEMO_SEED_VERSION) {
  const existing = loadConfig(DEMO_CALENDAR_ID);
  const carriedDefaultView = existing.display?.defaultView;
  const nextDefaultView = carriedDefaultView === 'base' ? 'month' : carriedDefaultView;
  // Theme migration: pre-v6 demos defaulted to 'ops-dark'. The new default
  // is 'industrial-light' (warmer, friendlier first impression). Replace the
  // old default in place; preserve any other theme the user actively chose.
  const carriedTheme = existing.setup?.preferredTheme;
  const nextTheme = carriedTheme && carriedTheme !== 'ops-dark' ? carriedTheme : 'industrial-light';
  // Merge dispatch + requests into whatever views the user had enabled.
  const carriedViews: string[] = existing.display?.enabledViews ?? [...DEFAULT_CONFIG.display.enabledViews];
  const nextEnabledViews = Array.from(new Set([...carriedViews, 'dispatch', 'requests']));
  saveConfig(DEMO_CALENDAR_ID, {
    ...existing,
    title:     existing.title ?? 'Air EMS Operations',
    setup:     { ...existing.setup, preferredTheme: nextTheme },
    display:   { ...existing.display, defaultView: nextDefaultView ?? 'month', enabledViews: nextEnabledViews },
    team:      { ...existing.team, bases: DEMO_BASES, regions: DEMO_REGIONS },
    approvals: { ...existing.approvals, enabled: true },
  });
  safeSetLocalStorage(SEED_VER_KEY, String(DEMO_SEED_VERSION));
}

// Theme is managed entirely inside the library's ownerConfig (setup.preferredTheme)
// so we don't duplicate it here. The seed/migration above already writes the
// correct initial value. Passing a `theme` prop from outside would shadow the
// config-driven value and make in-settings theme switching appear broken.

/* ─── Employees ────────────────────────────────────────────────── */
// Pilots + medical crew + mechanics rendered as the people roster. Each
// gets a role-coded color so the schedule view makes shift type obvious at
// a glance.
const PILOT_COLOR    = '#3b82f6';
const MEDICAL_COLOR  = '#10b981';
const SPECIAL_COLOR  = '#a855f7'; // ECMO specialist
const MECHANIC_COLOR = '#f97316';
const DISPATCHER_COLOR = '#0ea5e9';

const INITIAL_EMPLOYEES = [
  ...dispatchers.map(d => ({
    id:    d.id,
    name:  d.name,
    role:  `Dispatcher (${d.shiftType})`,
    color: DISPATCHER_COLOR,
    base:  d.basedAt,
  })),
  ...crew.map(c => ({
    id:    c.id,
    name:  c.name,
    role:  `Pilot (${c.certifications.join(', ')})`,
    color: PILOT_COLOR,
    base:  c.basedAt,
  })),
  ...medicalCrew.map(m => ({
    id:    m.id,
    name:  m.name,
    role:  m.certifications.join(' · '),
    color: m.certifications.some(c => c.includes('ECMO')) ? SPECIAL_COLOR : MEDICAL_COLOR,
    base:  m.basedAt,
  })),
  ...mechanics.map(m => ({
    id:    m.id,
    name:  m.name,
    role:  'Mechanic',
    color: MECHANIC_COLOR,
    base:  m.basedAt,
  })),
];

/* ─── Assets ───────────────────────────────────────────────────── */
// Fleet rows rendered by the Assets view. `group` is the region so the
// assets view can pivot by region; `meta.base` ties into the base column.
const REGION_BY_BASE = Object.fromEntries(bases.map(b => [b.id, regions.find(r => r.id === b.regionId)?.name ?? '']));

// Employees eligible for mission slot assignment (pilots + medical)
const MISSION_EMPLOYEES = [...crew, ...medicalCrew];

const AIRCRAFT_RESOURCES = EMS_ASSETS.map(a => ({
  id:    a.id,
  label: a.name,
  group: REGION_BY_BASE[a.basedAt] || 'Fleet',
  meta: {
    sublabel: a.capabilities.join(' · '),
    model:    a.type === 'helicopter' ? 'Helicopter' : 'Fixed-wing',
    base:     a.basedAt,
    status:   a.status,
    location: { text: bases.find(b => b.id === a.basedAt)?.name ?? '—', status: 'live', asOf: new Date().toISOString() },
  },
}));

/* ─── Events ───────────────────────────────────────────────────── */
// Convert the Air EMS dataset into WorksCalendar's event shape
// ({ id, title, start, end, category, resource, color }).

const DISPATCH_COLOR = '#0ea5e9';
const MAINT_COLOR    = '#ef4444';
const REQUEST_COLOR  = '#64748b';
const MISSION_COLOR  = '#a855f7';

function categoryColor(cat) {
  switch (cat) {
    case 'dispatch-shift':   return DISPATCH_COLOR;
    case 'pilot-shift':      return PILOT_COLOR;
    case 'medical-shift':    return MEDICAL_COLOR;
    case 'mechanic-shift':   return MECHANIC_COLOR;
    case 'on-call':          return MECHANIC_COLOR;
    case 'pto':              return '#94a3b8';
    case 'mission-assignment': return MISSION_COLOR;
    case 'maintenance':      return MAINT_COLOR;
    case 'training':         return '#f59e0b';
    case 'aircraft-request': return REQUEST_COLOR;
    case 'asset-request':    return REQUEST_COLOR;
    case 'base-event':       return '#64748b';
    default:                 return '#94a3b8';
  }
}

const APPROVAL_CATS = new Set(['maintenance', 'aircraft-request', 'asset-request']);

// Visual styles for the approval-stage chip rendered inside event pills via
// `renderEvent`. Same color logic as the Awaiting-your-approval card in the
// chrome so the pill chip and queue list read consistently.
const STAGE_PILL_STYLES = {
  requested: { label: 'Requested', bg: '#fef3c7', fg: '#92400e' },
  approved:  { label: 'Approved',  bg: '#dbeafe', fg: '#1e40af' },
  finalized: { label: 'Finalized', bg: '#dcfce7', fg: '#15803d' },
  denied:    { label: 'Denied',    bg: '#fee2e2', fg: '#991b1b' },
};

// Resource pool tagging — which roles + asset types can be the "resource"
// for each category. Drives the Add Event form's resource suggester so a
// maintenance event suggests mechanics & aircraft, a pilot-shift event
// suggests only pilots, etc. Categories not listed accept any resource.
const RESOURCE_POOL_BY_CATEGORY = {
  // Shifts pin to a single role
  'pilot-shift':    { roles: ['pilot'],                         assets: false  },
  'medical-shift':  { roles: ['rn', 'rt', 'medic'],             assets: false  },
  'mechanic-shift': { roles: ['mechanic'],                      assets: false  },
  'dispatch-shift': { roles: ['dispatcher'],                    assets: false  },
  'on-call':        { roles: ['mechanic', 'pilot', 'rn'],       assets: false  },
  'pto':            { roles: ['pilot', 'rn', 'rt', 'medic',
                              'mechanic', 'dispatcher'],         assets: false  },
  // Asset-centric categories
  'maintenance':       { roles: ['mechanic'],                    assets: true   },
  'aircraft-request':  { roles: [],                              assets: true   },
  'asset-request':     { roles: [],                              assets: true   },
  // Mission can be flown by any pilot/medical or aircraft
  'mission-assignment': { roles: ['pilot', 'rn', 'rt', 'medic'], assets: true   },
  'training':           { roles: ['pilot', 'rn', 'rt', 'medic',
                                  'mechanic'],                    assets: true   },
  'base-event':         { roles: [],                              assets: false  },
};

function suggestResourcesForCategory(category) {
  const pool = RESOURCE_POOL_BY_CATEGORY[category];
  // Unknown / empty category: suggest everyone + every asset.
  if (!pool) {
    return [
      ...ALL_EMPLOYEES.map(e => ({ value: e.id, label: `${e.name} (${e.role})` })),
      ...EMS_ASSETS.map(a => ({ value: a.id, label: `${a.name} — ${a.tail}` })),
    ];
  }
  const out = [];
  if (pool.roles.length > 0) {
    out.push(
      ...ALL_EMPLOYEES
        .filter(e => pool.roles.includes(e.role))
        .map(e => ({ value: e.id, label: `${e.name} (${e.role})` })),
    );
  }
  if (pool.assets) {
    out.push(
      ...EMS_ASSETS.map(a => ({ value: a.id, label: `${a.name} — ${a.tail}` })),
    );
  }
  return out;
}

// Categories that represent "schedule grain" content — shifts, PTO, on-call.
// The library's viewScope filters these out of Month/Week/Day/Agenda when an
// event sets `meta.kind` to a recognized schedule kind, so the high-level
// views aren't drowned in shift slivers (Schedule and Base tabs cover that
// detail). Map the demo's category-level naming onto the library's kinds.
//
// PTO is intentionally NOT tagged with a kind — `SCHEDULE_WORKFLOW_CATEGORIES`
// already filters it by category, and tagging it `kind: 'shift'` would make
// `isShiftOrOnCallEvent` (Crew-on-shift panel, Timeline shift-status) treat
// people on leave as actively working.
const SHIFT_CATS = new Set([
  'dispatch-shift', 'pilot-shift', 'medical-shift', 'mechanic-shift',
]);
function scheduleKindFor(category) {
  if (SHIFT_CATS.has(category)) return 'shift';
  if (category === 'on-call')    return 'on-call';
  return null;
}

const INITIAL_EVENTS = allEvents.map(e => {
  // Source events (e.g. mission crew assignments in emsData) may already carry
  // their own meta.kind. Don't override it — derive a kind from category only
  // when the source didn't pre-tag the event.
  const sourceMeta = (e as { meta?: Record<string, unknown> }).meta ?? null;
  const kind = (sourceMeta && typeof sourceMeta['kind'] === 'string')
    ? (sourceMeta['kind'] as string)
    : scheduleKindFor(e.category);
  const approvalMeta = APPROVAL_CATS.has(e.category)
    ? { approvalStage: { stage: e.visualPriority === 'high' ? 'requested' : 'approved', updatedAt: e.start } }
    : null;
  // Plot every event on the MapView by stamping coordinates from its base.
  // Events without basedAt fall back to the resource owner's base when known.
  const empBase = e.assignedTo
    ? [...dispatchers, ...crew, ...medicalCrew, ...mechanics].find(emp => emp.id === e.assignedTo)?.basedAt
    : undefined;
  const assetBase = e.assignedTo ? EMS_ASSETS.find(a => a.id === e.assignedTo)?.basedAt : undefined;
  const baseId = e.basedAt ?? empBase ?? assetBase;
  const baseCoords = baseId ? BASE_COORDS[baseId] : undefined;
  const coordsMeta = baseCoords ? { coords: baseCoords, baseId } : null;
  const meta = (sourceMeta || kind || approvalMeta || coordsMeta)
    ? { ...(sourceMeta ?? {}), ...(kind ? { kind } : {}), ...(approvalMeta ?? {}), ...(coordsMeta ?? {}) }
    : null;
  return {
    id: e.id, title: e.title, start: e.start, end: e.end,
    category: e.category,
    resource: e.assignedTo ?? null,
    color: categoryColor(e.category),
    visualPriority: e.visualPriority,
    ...(e.category === 'on-call' || e.category === 'pto' ? { allDay: true } : {}),
    ...(meta ? { meta } : {}),
  };
});

// Walkthrough fixtures: two seeded mission-assignment events at the same
// time on different aircraft. Step 2 of the guided tour exploits the
// overlap to demonstrate conflict detection. Aircraft were chosen because
// emsData has no other events on those slots, so the conflict is solely
// caused by Alpha+Bravo.
INITIAL_EVENTS.push(...buildWalkthroughEvents());

/* ─── Resource pools (#212) ─────────────────────────────────────── */
// Group aircraft by region so bookings can target a pool instead of a tail
// number; the round-robin cursor persists in localStorage. Resynced on the
// demo seed bump so returning visitors don't keep stale pool names (e.g.
// "Mountain Fleet" / "Southwest Fleet") from earlier demo identities.
// One pool per base containing every person and asset stationed there.
// Lets base-scoped dispatch resolve the full roster from a single
// membership lookup. The base id itself is intentionally NOT a member —
// pools feed `resolvePool` for booking, and a non-resource id selected
// by `first-available` would produce events assigned to the base
// instead of an employee/asset. The two original regional fleet pools
// are retained for round-robin aircraft selection.
const ALL_PERSONNEL = [...dispatchers, ...crew, ...medicalCrew, ...mechanics];
const DEMO_BASE_POOLS = bases.map(b => ({
  id: `pool-base-${b.id}`,
  name: `${b.name} — On Base`,
  memberIds: [
    ...ALL_PERSONNEL.filter(p => p.basedAt === b.id).map(p => p.id),
    ...EMS_ASSETS.filter(a => a.basedAt === b.id).map(a => a.id),
  ],
  strategy: 'first-available' as const,
}));
const DEMO_POOLS_DEFAULT = [
  { id: 'pool-pnw', name: 'Pacific Northwest Fleet', memberIds: ['ac-n801aw', 'ac-n803lj'], strategy: 'round-robin'     },
  { id: 'pool-rm',  name: 'Rocky Mountain Fleet',   memberIds: ['ac-n804aw', 'ac-n805pc'], strategy: 'first-available' },
  ...DEMO_BASE_POOLS,
];
const _storedPools = loadPools(DEMO_CALENDAR_ID);
if (_storedPools.length === 0 || storedSeedVer < DEMO_SEED_VERSION) {
  savePools(DEMO_CALENDAR_ID, DEMO_POOLS_DEFAULT);
}

/* ─── Categories ────────────────────────────────────────────────── */
const UNIFIED_CATEGORIES = [
  { id: 'dispatch-shift',    label: 'Dispatch',         color: DISPATCH_COLOR },
  { id: 'pilot-shift',       label: 'Pilot Shift',      color: PILOT_COLOR    },
  { id: 'medical-shift',     label: 'Medical Shift',    color: MEDICAL_COLOR  },
  { id: 'mechanic-shift',    label: 'Mechanic Shift',   color: MECHANIC_COLOR },
  { id: 'on-call',           label: 'On Call',          color: MECHANIC_COLOR },
  { id: 'pto',               label: 'PTO',              color: '#94a3b8'      },
  { id: 'mission-assignment', label: 'Mission',         color: MISSION_COLOR  },
  { id: 'maintenance',       label: 'Maintenance',      color: MAINT_COLOR    },
  { id: 'training',          label: 'Training',         color: '#f59e0b'      },
  { id: 'aircraft-request',  label: 'Aircraft Request', color: REQUEST_COLOR  },
  { id: 'asset-request',     label: 'Asset Request',    color: REQUEST_COLOR  },
  { id: 'base-event',        label: 'Base Event',       color: '#64748b'      },
  ...DEFAULT_CATEGORIES,
];

const UNIFIED_CATEGORIES_CONFIG = {
  categories: UNIFIED_CATEGORIES,
  pillStyle: 'hue',
  defaultCategoryId: 'other',
};

/* ─── Cascade scope helpers ─────────────────────────────────────── */
// Lookup maps so the cascade filter predicates can resolve an event's
// region / base / role tier in O(1) — events store the assigned resource id
// (employee or aircraft), not the rolled-up axes the cascade selects on.
const ALL_EMPLOYEES = [...dispatchers, ...crew, ...medicalCrew, ...mechanics];
const EMPLOYEE_BY_ID = new Map(ALL_EMPLOYEES.map(e => [e.id, e]));
const AIRCRAFT_BY_ID = new Map(EMS_ASSETS.map(a => [a.id, a]));
const BASE_REGION_BY_ID = new Map(bases.map(b => [b.id, b.regionId]));

function resolveEventBase(ev) {
  const emp = EMPLOYEE_BY_ID.get(ev.resource);
  if (emp) return emp.basedAt;
  const ac = AIRCRAFT_BY_ID.get(ev.resource);
  if (ac) return ac.basedAt;
  return ev.basedAt ?? null;
}
function resolveEventRegion(ev) {
  const baseId = resolveEventBase(ev);
  return baseId ? BASE_REGION_BY_ID.get(baseId) ?? null : null;
}
function resolveEventType(ev) {
  if (AIRCRAFT_BY_ID.has(ev.resource)) return 'asset';
  const emp = EMPLOYEE_BY_ID.get(ev.resource);
  if (!emp) return null;
  return emp.role === 'dispatcher' ? 'base' : 'crew';
}
function resolveEventSubType(ev) {
  const emp = EMPLOYEE_BY_ID.get(ev.resource);
  if (emp) {
    switch (emp.role) {
      case 'pilot':      return 'pilot';
      case 'rn':
      case 'rt':
      case 'medic':      return 'medical';
      case 'mechanic':   return 'maintenance';
      case 'dispatcher': return 'dispatch';
      default:           return null;
    }
  }
  const ac = AIRCRAFT_BY_ID.get(ev.resource);
  if (ac) return ac.type === 'helicopter' ? 'helicopter' : 'fixed-wing';
  return null;
}
function resolveEventShiftPattern(ev) {
  const emp = EMPLOYEE_BY_ID.get(ev.resource);
  return emp ? emp.shiftType : null;
}
function resolveEventCertifications(ev) {
  const emp = EMPLOYEE_BY_ID.get(ev.resource);
  return emp ? emp.certifications : [];
}

// `multi-select` predicates accept either a Set (engine-side) or a string[]
// (rare host-side path); collapse into a single membership check.
function valueHas(value, key) {
  if (key == null) return false;
  return value instanceof Set ? value.has(key) : Array.isArray(value) && value.includes(key);
}

/* ─── Filter schema ─────────────────────────────────────────────── */
// `buildDefaultFilterSchema` gives us categories / resources / sources /
// dateRange / search. We add region / base / type / subType / shiftPattern /
// certifications so the cascade UI's tier ids round-trip through the engine.
// Category / Resource / Source aren't useful as *grouping* axes for this
// dataset (the cascade owns scoping, the toolbar owns display mode), so we
// flag them ungroupable.
const CASCADE_FIELD_BY_KEY = {
  region: {
    type:      'multi-select',
    operators: ['in', 'not-in'],
    groupable: false,
    predicate: (item, value) => valueHas(value, resolveEventRegion(item)),
    getOptions: () => regions.map(r => ({ value: r.id, label: r.name })),
  },
  base: {
    type:      'multi-select',
    operators: ['in', 'not-in'],
    groupable: false,
    predicate: (item, value) => valueHas(value, resolveEventBase(item)),
    getOptions: () => bases.map(b => ({ value: b.id, label: b.name })),
  },
  type: {
    type:      'multi-select',
    operators: ['in', 'not-in'],
    groupable: false,
    predicate: (item, value) => valueHas(value, resolveEventType(item)),
    getOptions: () => [
      { value: 'crew',  label: 'Crew'  },
      { value: 'base',  label: 'Base'  },
      { value: 'asset', label: 'Asset' },
    ],
  },
  subType: {
    type:      'multi-select',
    operators: ['in', 'not-in'],
    groupable: false,
    predicate: (item, value) => valueHas(value, resolveEventSubType(item)),
    getOptions: () => [
      { value: 'pilot',       label: 'Pilot'       },
      { value: 'medical',     label: 'Medical'     },
      { value: 'maintenance', label: 'Maintenance' },
      { value: 'dispatch',    label: 'Dispatch'    },
      { value: 'helicopter',  label: 'Helicopter'  },
      { value: 'fixed-wing',  label: 'Fixed-wing'  },
    ],
  },
  shiftPattern: {
    type:      'multi-select',
    operators: ['in', 'not-in'],
    groupable: false,
    predicate: (item, value) => valueHas(value, resolveEventShiftPattern(item)),
    getOptions: () => [
      { value: 'day',     label: 'Day'     },
      { value: 'night',   label: 'Night'   },
      { value: 'on-call', label: 'On call' },
    ],
  },
  certifications: {
    type:      'multi-select',
    operators: ['in', 'not-in'],
    groupable: false,
    predicate: (item, value) => {
      const certs = resolveEventCertifications(item);
      if (!certs || certs.length === 0) return false;
      if (value instanceof Set) return certs.some(c => value.has(c));
      return Array.isArray(value) && certs.some(c => value.includes(c));
    },
    getOptions: () => {
      const seen = new Set();
      ALL_EMPLOYEES.forEach(e => e.certifications.forEach(c => seen.add(c)));
      return [...seen].sort().map(c => ({ value: c, label: c }));
    },
  },
};

const CASCADE_FIELDS = CASCADE_FILTER_DEFINITIONS.map(def => ({
  key: def.key,
  label: def.label,
  ...CASCADE_FIELD_BY_KEY[def.key],
}));

/* ─── Cascade config ────────────────────────────────────────────── */
// Tier ids match the filter-schema field keys above so the cascade UI's
// selections round-trip through the engine without translation.
const SUBTYPE_BY_TYPE = {
  crew:  ['pilot', 'medical', 'maintenance'],
  base:  ['dispatch'],
  asset: ['helicopter', 'fixed-wing'],
};

const SUBTYPE_LABELS = {
  pilot:       'Pilot',
  medical:     'Medical',
  maintenance: 'Maintenance',
  dispatch:    'Dispatch',
  helicopter:  'Helicopter',
  'fixed-wing':'Fixed-wing',
};

const DEMO_CASCADE_CONFIG = buildDemoCascadeConfig({
  region:        CASCADE_FIELD_BY_KEY.region.getOptions,
  base: (sel) => {
    const regionFilter = sel.region ?? [];
    return bases
      .filter(b => regionFilter.length === 0 || regionFilter.includes(b.regionId))
      .map(b => ({ value: b.id, label: b.name }));
  },
  type:          CASCADE_FIELD_BY_KEY.type.getOptions,
  subType: (sel) => {
    const typeFilter = sel.type ?? [];
    const allowed = typeFilter.length === 0
      ? Object.values(SUBTYPE_BY_TYPE).flat()
      : typeFilter.flatMap(t => SUBTYPE_BY_TYPE[t] ?? []);
    return allowed.map(v => ({ value: v, label: SUBTYPE_LABELS[v] ?? v }));
  },
  shiftPattern:  CASCADE_FIELD_BY_KEY.shiftPattern.getOptions,
  certifications: CASCADE_FIELD_BY_KEY.certifications.getOptions,
});

/* ─── Approval state machine (demo) ─────────────────────────────── */
function nextStageFor(currentStage, actionId) {
  const stage = currentStage ?? 'requested';
  switch (actionId) {
    case 'approve':  return stage === 'pending_higher' ? 'finalized' : 'approved';
    case 'deny':     return 'denied';
    case 'finalize': return 'finalized';
    case 'revoke':   return stage === 'finalized'      ? 'approved'  : 'requested';
    default:         return null;
  }
}

function applyApprovalTransition(event, actionId, payload) {
  const stage = event?.meta?.approvalStage;
  const currentStage = stage?.stage ?? 'requested';
  const nextStage = nextStageFor(currentStage, actionId);
  if (!nextStage) return event;

  const now = new Date().toISOString();
  const historyEntry = {
    action: actionId, at: now, actor: payload?.actor ?? 'demo-user',
    ...(payload?.tier   !== undefined ? { tier:   payload.tier   } : {}),
    ...(payload?.reason !== undefined ? { reason: payload.reason } : {}),
  };
  return {
    ...event,
    meta: {
      ...(event.meta ?? {}),
      approvalStage: {
        stage:     nextStage,
        updatedAt: now,
        history:   [...(stage?.history ?? []), historyEntry],
      },
    },
  };
}

/* ─── PWA update toast ──────────────────────────────────────────── */
function UpdateToast({ onUpdate, onDismiss }) {
  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      background: '#1e293b', color: '#f1f5f9', borderRadius: 10,
      padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 24px rgba(0,0,0,.35)', zIndex: 9999, fontSize: 13,
      border: '1px solid #334155',
    }}>
      <span>A new version is available.</span>
      <button
        onClick={onUpdate}
        style={{
          background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6,
          padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
        }}
      >
        Update
      </button>
      <button
        onClick={onDismiss}
        style={{
          background: 'transparent', color: '#94a3b8', border: 'none',
          cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px',
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

/* ─── Demo App ──────────────────────────────────────────────────── */
// `?embed=1` skips the marketing chrome and renders the calendar
// full-bleed. e2e tests and any page that wants to embed the demo as
// a raw calendar use this flag; the default `/` route shows the
// framed Landing layout.
const EMBED_MODE =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('embed');

function App() {
  const [events,            setEvents]            = useState(INITIAL_EVENTS);
  const [notes,             setNotes]             = useState({});
  const [employees,         setEmployees]         = useState(INITIAL_EMPLOYEES);
  const [eventLog,          setEventLog]          = useState([]);
  const [needsRefresh,      setNeedsRefresh]      = useState(false);
  const [missionAssignments, setMissionAssignments] = useState<typeof mission.assignments & { aircraft: string | null }>({
    ...mission.assignments,
    aircraft: null, // starts unassigned so the pulsing badge is visible on load
  });
  const [activeMissionEvent, setActiveMissionEvent] = useState<WorksCalendarEvent | null>(null);
  const [activeProfileId,   setActiveProfileId]   = useState(DEFAULT_PROFILE_ID);
  const activeProfile = useMemo(() => findProfile(activeProfileId), [activeProfileId]);
  const [pools, setPools] = useState<typeof DEMO_POOLS_DEFAULT>(() => {
    const persisted = loadPools(DEMO_CALENDAR_ID);
    return persisted.length > 0 ? persisted : DEMO_POOLS_DEFAULT;
  });

  const handlePoolsChange = useCallback((next: typeof DEMO_POOLS_DEFAULT) => {
    setPools(next);
    savePools(DEMO_CALENDAR_ID, next);
  }, []);

  const assetLocationProvider = useMemo(
    () => createManualLocationProvider({ resources: AIRCRAFT_RESOURCES }),
    [],
  );

  // ── Dispatch view wiring ────────────────────────────────────────
  // The library's DispatchView is generic — it knows nothing about
  // pilots, certs, aircraft hours, etc. Air EMS specifics live in
  // ./dispatchEvaluator and feed in via these two props.
  const dispatchMissions = useMemo(() => ([
    { id: mission.id, label: mission.title, sublabel: 'Pending — needs aircraft' },
  ]), []);

  const dispatchEvaluator = useMemo(() => {
    const missionsById = { [mission.id]: mission };
    // isBookedAt — quick scan of the live event store. Events without a
    // resource binding (base-wide events) don't lock individual crew.
    const isBookedAt = (resourceId, at) => {
      const t = at.getTime();
      for (const ev of events) {
        if (ev?.resource == null) continue;
        if (String(ev.resource) !== resourceId) continue;
        const s = new Date(ev.start).getTime();
        const e = new Date(ev.end).getTime();
        if (s <= t && e >= t) return true;
      }
      return false;
    };
    return makeDispatchEvaluator({
      aircraft: EMS_ASSETS,
      pilots: crew,
      medicalCrew,
      missionsById,
      isBookedAt,
      baseCoords: BASE_COORDS,
    });
  }, [events]);

  const [updateSW] = useState(() =>
    DEMO_FEATURES.pwaRegistration ? registerSW({
      onNeedRefresh()  { setNeedsRefresh(true); },
      onOfflineReady() { console.info('[PWA] App ready to work offline.'); },
      onRegisteredSW(_swUrl, r) {
        if (!r) return;
        void r.update();
        const check = () => { if (!document.hidden) void r.update(); };
        window.addEventListener('focus', check);
        document.addEventListener('visibilitychange', check);
      },
    }) : (() => undefined)
  );

  useEffect(() => {
    if (!needsRefresh) return;
    void updateSW(true);
    setNeedsRefresh(false);
  }, [needsRefresh, updateSW]);

  const log = (msg: string) => setEventLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 8));

  const handleConfigSave = useCallback(() => {
    log('Config saved');
  }, []);

  const handleEventSave = useCallback((ev: WorksCalendarEvent) => {
    setEvents(prev => {
      const idx = prev.findIndex(e => e.id === ev.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = ev; return next; }
      return [...prev, ev];
    });
    log(`Saved: ${ev.title}`);
  }, []);

  const handleEventMove = useCallback((ev: WorksCalendarEvent, newStart: Date, newEnd: Date) => {
    const moved = {
      ...ev,
      start: newStart,
      end: newEnd,
    };
    handleEventSave(moved);
    log(`Moved: ${ev.title}`);
  }, [handleEventSave]);

  // When the dispatcher clicks "Assign" on an available aircraft row, create
  // a mission-assignment event that books the aircraft for the mission window.
  const handleDispatchAssign = useCallback((assetId, missionId, _asOf) => {
    const m = missionId === mission.id ? mission : null;
    if (!m) {
      log(`Dispatch: unknown mission ${missionId}`);
      return;
    }
    const asset = EMS_ASSETS.find(a => a.id === assetId);
    const assetName = asset?.name ?? assetId;
    const newEvent = {
      id: `dispatch-${assetId}-${Date.now()}`,
      title: `${m.title} — ${assetName}`,
      start: m.start,
      end:   m.end,
      category: 'mission-assignment',
      resource: assetId,
      color: MISSION_COLOR,
      visualPriority: 'high',
    };
    handleEventSave(newEvent);
    log(`Dispatched ${assetName} to ${m.title}`);
  }, [handleEventSave]);

  const handleEventDelete = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    log(`Deleted: ${id}`);
  }, []);

  const handleNoteSave = useCallback((note) => {
    setNotes(prev => ({ ...prev, [note.eventId]: { id: `note-${note.eventId}`, ...note } }));
    log(`Note saved for ${note.eventId}`);
  }, []);

  const handleNoteDelete = useCallback((noteId) => {
    setNotes(prev => {
      const next = { ...prev };
      const key = Object.keys(next).find(k => next[k].id === noteId);
      if (key) delete next[key];
      return next;
    });
    log(`Note deleted: ${noteId}`);
  }, []);

  const handleEmployeeAdd = useCallback((emp) => {
    setEmployees(prev => [...prev, emp]);
    log(`Added employee: ${emp.name}`);
  }, []);

  const handleEmployeeDelete = useCallback((id) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    log(`Removed employee: ${id}`);
  }, []);

  const handleApprovalAction = useCallback((event: WorksCalendarEvent, actionId: string, payload?: { actor?: string; tier?: number; reason?: string }) => {
    // Profile-driven gating: each role has a capability matrix in
    // demo/profiles.ts. A dispatcher can request but not approve; an
    // ops manager can finalize and revoke; etc. Block actions the
    // active role can't perform — that's how the profile switcher
    // demos the approval hierarchy.
    const capKey = APPROVAL_ACTION_CAP[actionId];
    if (capKey && !activeProfile.approval[capKey]) {
      log(`Blocked: ${activeProfile.role} cannot ${actionId} this request`);
      return;
    }
    const nextStage = nextStageFor(event?.meta?.approvalStage?.stage ?? 'requested', actionId);
    if (!nextStage) {
      log(`Approval: ${actionId} not allowed from ${event?.meta?.approvalStage?.stage ?? 'requested'}`);
      return;
    }
    setEvents(prev => prev.map(e => e.id === event.id ? applyApprovalTransition(e, actionId, payload) : e));
    log(`Approval: ${event.title} → ${nextStage} (as ${activeProfile.role})`);
  }, [activeProfile]);

  const handleEventClick = useCallback((ev: WorksCalendarEvent) => {
    log(`Clicked: ${ev.title}`);
    // wt-mission is the walkthrough's Mission Alpha — it uses the standard
    // HoverCard → Edit → EventForm flow so onEventSave fires and the
    // walkthrough can detect the pilot assignment. Exclude it from opening
    // the São Paulo MissionHoverCard.
    if (ev.id === WALKTHROUGH_MISSION_ID) return;
    if (ev.category === 'mission-assignment' || ev.category === 'aircraft-request') {
      setActiveMissionEvent(ev);
    }
  }, []);

  // Append visual cues to event pills:
  //   - "REQS UNMET" pulsing badge when a mission isn't fully staffed
  //   - Approval-stage chip (REQUESTED / APPROVED / FINALIZED / DENIED) so
  //     users can see the workflow state at a glance without opening the
  //     hover card. Without this, an aircraft-request pill looks identical
  //     whether it's awaiting first approval or already finalized.
  const renderEvent = useCallback((ev: WorksCalendarEvent) => {
    const stage = ev?.meta?.approvalStage?.stage ?? null;
    const isMissionLike = ev.category === 'mission-assignment' || ev.category === 'aircraft-request';
    const showUnmet = isMissionLike && !allRequirementsMet(missionAssignments, mission, EMS_ASSETS);

    if (!stage && !showUnmet) return null;

    const stageStyles = stage ? STAGE_PILL_STYLES[stage] : null;

    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', width: '100%' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          {ev.title}
        </span>
        {stageStyles && (
          <span style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', padding: '1px 5px', borderRadius: 3,
            background: stageStyles.bg, color: stageStyles.fg,
            flexShrink: 1, minWidth: 0, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4,
          }}>
            {stageStyles.label}
          </span>
        )}
        {showUnmet && <span className={missionStyles.unmetBadge}>REQS UNMET</span>}
      </span>
    );
  }, [missionAssignments]);

  const renderHoverCard = useCallback((ev: WorksCalendarEvent, onCloseHover: () => void) => {
    // Keep walkthrough mission on the built-in HoverCard so Edit routes to
    // the stock EventForm/onEventSave flow used by guided Step 2/3.
    if (ev.id === WALKTHROUGH_MISSION_ID) return null;
    return (
      <DemoHoverCard
        event={ev}
        onClose={onCloseHover}
        onApprovalAction={handleApprovalAction}
        approvalCaps={activeProfile.approval}
        onEdit={(event) => {
          setActiveMissionEvent(null);
          calendarApiRef.current?.openEvent?.(event.id);
        }}
        onDelete={(id) => { handleEventDelete(id); onCloseHover(); }}
      />
    );
  }, [activeProfile.approval, handleApprovalAction, handleEventDelete]);

  // ── Guided walkthrough wiring ───────────────────────────────────
  // The walkthrough wraps the existing host callbacks so it can detect
  // user gestures (drag-to-move, drag-to-reassign, view switch) without
  // changing the demo's behavior. Suppressed in EMBED_MODE so the raw
  // calendar embed used by e2e tests stays free of demo chrome.
  // Stable pilot-id set for the walkthrough's Step 3 matcher. Built from
  // emsData.crew (which is `pilots`) so adding/removing pilots in the demo
  // dataset auto-updates the walkthrough without a separate edit.
  const walkthroughPilotIds = useMemo(
    () => new Set<string>(crew.map(p => p.id)),
    [],
  );

  const walkthrough = useWalkthrough({
    ctx: {
      missionEventId:         WALKTHROUGH_MISSION_ID,
      conflictPilotId:        CONFLICT_PILOT_ID,
      missionInitialStartIso: ALPHA_INITIAL_START_ISO,
      pilotIds:               walkthroughPilotIds,
    },
    delegate: { onEventMove: handleEventMove, onEventSave: handleEventSave },
    calendarId: DEMO_CALENDAR_ID,
  });

  // Snap the calendar to the walkthrough seed slot on first guided mount.
  // Forces (a) Week view, since the operator workflow the walkthrough
  // teaches lives there ("a request lands on the week, scheduler moves it,
  // then fills it"), and (b) navigates currentDate to the seed date so the
  // unassigned mission is on screen regardless of "today".
  //
  // Wiring: callback ref populates calendarApiRef when WorksCalendar attaches
  // its imperative handle. The actual setView/navigateTo calls live in a
  // parent useEffect so they run AFTER the calendar's own mount effects —
  // specifically the defaultView-applied effect at WorksCalendar.tsx:745
  // which would otherwise reset state.view to the stored 'schedule' (or
  // whatever returning visitors had) right after our snap.
  //
  // Skipped in EMBED_MODE so e2e tests keep their real "today" landing, and
  // skipped if the user has already engaged with the walkthrough.
  const calendarApiRef = useRef(null);
  const didSnapRef     = useRef(false);
  const shouldSnapWalkthroughRef = useRef(DEMO_FEATURES.walkthrough && !EMBED_MODE && walkthrough.state.mode !== 'free-play' && walkthrough.state.history.length === 0);

  const calendarRef = useCallback((api) => {
    calendarApiRef.current = api;
  }, []);

  useEffect(() => {
    if (didSnapRef.current) return;
    if (!shouldSnapWalkthroughRef.current) return;
    const api = calendarApiRef.current;
    if (!api?.navigateTo || !api?.setView) return;
    api.setView('week');
    api.navigateTo(new Date(ALPHA_INITIAL_START_ISO));
    didSnapRef.current = true;
  }, []);

  // Restart wraps walkthrough.restart with the cleanup the state-machine
  // alone can't do: re-seed the demo events (so Mission Alpha is unassigned
  // and Bravo's conflicting shift is back in place) and snap the calendar
  // view + date back to the seed slot. Without this, hitting "Restart tour"
  // after completing the run sends the user to Step 1 ("drag the unassigned
  // mission") with the mission still pinned to whatever pilot they assigned
  // last time — narrative breaks immediately.
  const handleRestart = useCallback(() => {
    setEvents(prev => {
      const nonWalkthrough = prev.filter(e =>
        e.id !== WALKTHROUGH_MISSION_ID && e.id !== WALKTHROUGH_DECOY_SHIFT_ID,
      );
      return [...nonWalkthrough, ...buildWalkthroughEvents()];
    });
    const api = calendarApiRef.current;
    api?.setView?.('week');
    api?.navigateTo?.(new Date(ALPHA_INITIAL_START_ISO));
    walkthrough.restart();
  }, [walkthrough.restart]);

  const calendar = (
    <WorksCalendar
      ref={calendarRef}
      events={events}
      employees={employees}
      assets={AIRCRAFT_RESOURCES}
      pools={pools}
      onPoolsChange={handlePoolsChange}
      strictAssetFiltering={true}
      assetRequestCategories={['maintenance', 'aircraft-request', 'asset-request', 'training', 'mission-assignment']}
      onEmployeeAdd={handleEmployeeAdd}
      onEmployeeDelete={handleEmployeeDelete}
      calendarId={DEMO_CALENDAR_ID}
      ownerPassword="demo1234"
      showSetupLanding
      onConfigSave={handleConfigSave}
      notes={notes}
      onNoteSave={handleNoteSave}
      onNoteDelete={handleNoteDelete}
      onEventSave={EMBED_MODE ? handleEventSave : walkthrough.wrapped.onEventSave}
      onEventMove={EMBED_MODE ? handleEventMove : walkthrough.wrapped.onEventMove}
      onViewChange={EMBED_MODE ? undefined : walkthrough.wrapped.onViewChange}
      onMapWidgetOpenChange={EMBED_MODE ? undefined : walkthrough.wrapped.onMapWidgetOpenChange}
      onEventDelete={handleEventDelete}
      onScheduleSave={handleEventSave}
      onAvailabilitySave={handleEventSave}
      onApprovalAction={handleApprovalAction}
      onEventClick={handleEventClick}
      renderEvent={renderEvent}
      renderHoverCard={renderHoverCard}
      showAddButton={true}
      hideEventTemplates={true}
      eventResourceSuggestions={suggestResourcesForCategory}
      categoriesConfig={UNIFIED_CATEGORIES_CONFIG}
      locationProvider={assetLocationProvider}
      filterSchema={DEMO_FILTER_SCHEMA}
      cascadeConfig={DEMO_CASCADE_CONFIG}
      role={activeProfile.permissionRole}
      dispatchMissions={dispatchMissions}
      dispatchEvaluator={dispatchEvaluator}
      onDispatchAssign={handleDispatchAssign}
      mapStyle="https://tiles.openfreemap.org/styles/liberty"
      showMapWidget={DEMO_FEATURES.mapWidget}
      enableApprovalFlowsTab={DEMO_FEATURES.workflowBuilder}
    />
  );

  return (
    <>
      {EMBED_MODE ? (
        <div style={{ height: '100vh', width: '100vw' }}>{calendar}</div>
      ) : (
        <Landing
          activeProfile={activeProfile}
          onProfileChange={setActiveProfileId}
          events={events}
        >
          {calendar}
        </Landing>
      )}

      {activeMissionEvent && DEMO_FEATURES.missionHoverCard && (
        <MissionHoverCard
          mission={{ ...mission, title: activeMissionEvent.title }}
          assignments={missionAssignments}
          employees={MISSION_EMPLOYEES}
          aircraft={EMS_ASSETS}
          onAssignmentChange={setMissionAssignments}
          onClose={() => setActiveMissionEvent(null)}
        />
      )}

      {needsRefresh && (
        <UpdateToast
          onUpdate={() => { updateSW(true); setNeedsRefresh(false); }}
          onDismiss={() => setNeedsRefresh(false)}
        />
      )}

      {!EMBED_MODE && DEMO_FEATURES.walkthrough && (
        <WalkthroughHost
          step={walkthrough.step}
          state={walkthrough.state}
          steps={walkthrough.steps}
          onAdvance={walkthrough.advance}
          onRestart={handleRestart}
          onExit={walkthrough.exit}
        />
      )}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><DemoErrorBoundary><App /></DemoErrorBoundary></StrictMode>
);
