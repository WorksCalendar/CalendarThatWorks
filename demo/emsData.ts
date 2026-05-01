/**
 * demo/emsData.ts — Air EMS operational demo dataset.
 *
 * Pacific Northwest + Rocky Mountain regions, 5 bases, 6 aircraft,
 * 4 staffing layers (dispatch / pilots / medical / mechanics), on-call
 * rotation, maintenance, training, aircraft requests, and one international
 * critical-care transfer mission (São Paulo → Munich, 4 legs).
 *
 * All datetimes are local-time ISO-8601 strings, anchored to the Monday
 * of the current week (whatever "today" is at module load). Originally the
 * dataset was hardcoded to the week of 2026-04-20; without anchoring, the
 * events drifted out of the calendar's visible window once the system
 * clock moved past late April 2026, leaving public visitors with a blank
 * demo. The week-relative offsets below preserve the original schedule
 * shape (Mon → Sun = offsets 0–6, next-week Mon → Tue = 7–8, week-3 Mon
 * = 14) so the same narrative reads the same regardless of when the
 * demo loads. Records are still plain objects — no Date, Map, Set, or
 * class instances.
 */

import { addDays, format, startOfWeek } from 'date-fns';

import type { DemoRegion, DemoBase, DemoAircraft } from './types';

// ── Date anchor ──────────────────────────────────────────────────────────────
// `_DATASET_ANCHOR` = Monday of the current week. Every event below derives
// its date from `ymd(offset)` so the dataset slides forward with real time.
// Computed once at module load so a multi-day session doesn't shift events
// mid-render. Refreshing the page picks up the new anchor.
const _DATASET_ANCHOR = startOfWeek(new Date(), { weekStartsOn: 1 });

/** YYYY-MM-DD for an offset (in days) from the dataset's Monday anchor. */
function ymd(offset: number): string {
  return format(addDays(_DATASET_ANCHOR, offset), 'yyyy-MM-dd');
}

/** Local-time ISO `YYYY-MM-DDTHH:MM` for an offset + time-of-day. */
function dt(offset: number, time: string): string {
  return `${ymd(offset)}T${time}`;
}

// ── Geography ─────────────────────────────────────────────────────────────────

export const regions: DemoRegion[] = [
  { id: 'r-pnw', name: 'Pacific Northwest' },
  { id: 'r-rm',  name: 'Rocky Mountain'   },
];

export const bases: DemoBase[] = [
  { id: 'b-seattle',  name: 'Seattle (Hub)',  regionId: 'r-pnw' },
  { id: 'b-portland', name: 'Portland',       regionId: 'r-pnw' },
  { id: 'b-denver',   name: 'Denver (Hub)',   regionId: 'r-rm'  },
  { id: 'b-slc',      name: 'Salt Lake City', regionId: 'r-rm'  },
  { id: 'b-bozeman',  name: 'Bozeman',        regionId: 'r-rm'  },
];

// ── Fleet ─────────────────────────────────────────────────────────────────────

export const aircraft: DemoAircraft[] = [
  {
    id: 'ac-n801aw', tail: 'N801AW', name: 'AW139 N801AW',
    type: 'helicopter', hoursRemaining: 45, basedAt: 'b-seattle',
    capabilities: ['IFR', 'Night', 'NICU', 'Vent', 'Isolette'],
    status: 'available',
  },
  {
    id: 'ac-n802ec', tail: 'N802EC', name: 'EC135 N802EC',
    type: 'helicopter', hoursRemaining: 62, basedAt: 'b-portland',
    capabilities: ['IFR', 'Night', 'Rotor'],
    status: 'available',
  },
  {
    id: 'ac-n803lj', tail: 'N803LJ', name: 'Learjet 45 N803LJ',
    type: 'fixed-wing', hoursRemaining: 38, basedAt: 'b-seattle',
    capabilities: ['IFR', 'International', 'Critical Care', 'Long-Range'],
    status: 'assigned',
  },
  {
    id: 'ac-n804aw', tail: 'N804AW', name: 'AW139 N804AW',
    type: 'helicopter', hoursRemaining: 51, basedAt: 'b-denver',
    capabilities: ['IFR', 'Night', 'NICU', 'Vent'],
    status: 'available',
  },
  {
    id: 'ac-n805pc', tail: 'N805PC', name: 'PC-12 N805PC',
    type: 'fixed-wing', hoursRemaining: 77, basedAt: 'b-slc',
    capabilities: ['IFR', 'Fixed-Wing', 'Mountain Ops'],
    status: 'available',
  },
  {
    id: 'ac-n806ec', tail: 'N806EC', name: 'EC135 N806EC',
    type: 'helicopter', hoursRemaining: 12, basedAt: 'b-bozeman',
    capabilities: ['VFR', 'Rotor'],
    status: 'maintenance',
  },
];

/** Backward-compat alias used by App.tsx. */
export const assets = aircraft;

import type { DemoEmployee } from './types';

// ── Personnel ─────────────────────────────────────────────────────────────────

export const dispatchers: DemoEmployee[] = [
  { id: 'emp-marcus', name: 'Marcus Chen',   role: 'dispatcher', certifications: [], shiftType: 'day',    dutyStatus: 'on-duty',  basedAt: 'b-seattle'  },
  { id: 'emp-diane',  name: 'Diane Foster',  role: 'dispatcher', certifications: [], shiftType: 'night',  dutyStatus: 'on-duty',  basedAt: 'b-seattle'  },
  { id: 'emp-ryan',   name: 'Ryan Park',     role: 'dispatcher', certifications: [], shiftType: 'day',    dutyStatus: 'on-duty',  basedAt: 'b-portland' },
  { id: 'emp-lisa',   name: 'Lisa Morales',  role: 'dispatcher', certifications: [], shiftType: 'day',    dutyStatus: 'on-duty',  basedAt: 'b-denver'   },
  { id: 'emp-tom',    name: 'Tom Gaines',    role: 'dispatcher', certifications: [], shiftType: 'night',  dutyStatus: 'on-duty',  basedAt: 'b-denver'   },
  { id: 'emp-ana',    name: 'Ana Reeves',    role: 'dispatcher', certifications: [], shiftType: 'day',    dutyStatus: 'on-duty',  basedAt: 'b-slc'      },
];

export const pilots: DemoEmployee[] = [
  { id: 'emp-james',  name: 'Capt. James Wright',  role: 'pilot', certifications: ['IFR', 'International', 'Fixed-Wing'], shiftType: 'day',    dutyStatus: 'on-duty',  basedAt: 'b-seattle'  },
  { id: 'emp-priya',  name: 'Capt. Priya Shah',    role: 'pilot', certifications: ['IFR', 'Rotor', 'Night'],              shiftType: 'night',  dutyStatus: 'on-duty',  basedAt: 'b-seattle'  },
  { id: 'emp-derek',  name: 'F/O Derek Mills',     role: 'pilot', certifications: ['IFR', 'Rotor'],                       shiftType: 'day',    dutyStatus: 'off-duty', basedAt: 'b-portland' },
  { id: 'emp-elena',  name: 'Capt. Elena Vasquez', role: 'pilot', certifications: ['IFR', 'International', 'Fixed-Wing'], shiftType: 'day',    dutyStatus: 'on-duty',  basedAt: 'b-denver'   },
  { id: 'emp-kevin',  name: 'F/O Kevin Holt',      role: 'pilot', certifications: ['IFR', 'Rotor'],                       shiftType: 'night',  dutyStatus: 'on-duty',  basedAt: 'b-denver'   },
  { id: 'emp-dana',   name: 'Capt. Dana Pierce',   role: 'pilot', certifications: ['IFR', 'Rotor', 'Mountain'],           shiftType: 'day',    dutyStatus: 'on-duty',  basedAt: 'b-slc'      },
  { id: 'emp-cody',   name: 'F/O Cody Barnes',     role: 'pilot', certifications: ['IFR', 'Rotor'],                       shiftType: 'on-call', dutyStatus: 'on-call', basedAt: 'b-bozeman'  },
];

/** Backward-compat alias used by App.tsx. */
export const crew = pilots;

export const medicalCrew: DemoEmployee[] = [
  { id: 'emp-keely',  name: 'Keely Frost',   role: 'rn',    certifications: ['RN – Critical Care', 'RN – Flight'],                              shiftType: 'day',     dutyStatus: 'on-duty',  basedAt: 'b-seattle'  },
  { id: 'emp-alex',   name: 'Alex Torres',   role: 'rt',    certifications: ['RT – Vent', 'International Transfer Capable'],                    shiftType: 'night',   dutyStatus: 'on-duty',  basedAt: 'b-seattle'  },
  { id: 'emp-sam',    name: 'Sam Nguyen',    role: 'rn',    certifications: ['RN – Flight', 'ECMO Capable', 'International Transfer Capable'],  shiftType: 'on-call', dutyStatus: 'on-call',  basedAt: 'b-seattle'  },
  { id: 'emp-jordan', name: 'Jordan Park',   role: 'medic', certifications: ['Medic – Neonatal'],                                               shiftType: 'day',     dutyStatus: 'on-duty',  basedAt: 'b-portland' },
  { id: 'emp-nina',   name: 'Nina Castro',   role: 'rn',    certifications: ['RN – Critical Care', 'RN – Flight'],                              shiftType: 'day',     dutyStatus: 'on-duty',  basedAt: 'b-denver'   },
  { id: 'emp-david',  name: 'David Kim',     role: 'rt',    certifications: ['RT – Vent'],                                                       shiftType: 'night',   dutyStatus: 'on-duty',  basedAt: 'b-denver'   },
  { id: 'emp-grace',  name: 'Grace Taylor',  role: 'medic', certifications: ['Medic – Neonatal'],                                               shiftType: 'day',     dutyStatus: 'off-duty', basedAt: 'b-slc'      },
];

export const mechanics: DemoEmployee[] = [
  { id: 'emp-mike',  name: 'Mike Santos',  role: 'mechanic', certifications: ['A&P'], shiftType: 'on-call', dutyStatus: 'on-call', basedAt: 'b-seattle' },
  { id: 'emp-sarah', name: 'Sarah Powell', role: 'mechanic', certifications: ['A&P'], shiftType: 'day',     dutyStatus: 'on-duty', basedAt: 'b-denver'  },
];

import type { DemoEvent } from './types';

// ── Internal helpers ──────────────────────────────────────────────────────────
// (Not exported — only the typed arrays below are public API.)

function nd(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

type EC = DemoEvent['category'];

function dayShifts(
  prefix: string, title: string, person: string, base: string,
  dates: readonly string[], cat: EC,
): DemoEvent[] {
  return dates.map((d, i) => ({
    id: `${prefix}-${i + 1}`, title, category: cat, visualPriority: 'muted',
    start: `${d}T07:00`, end: `${d}T19:00`, assignedTo: person, basedAt: base,
  }));
}

function nightShifts(
  prefix: string, title: string, person: string, base: string,
  dates: readonly string[], cat: EC,
): DemoEvent[] {
  return dates.map((d, i) => ({
    id: `${prefix}-${i + 1}`, title, category: cat, visualPriority: 'muted',
    start: `${d}T19:00`, end: `${nd(d)}T07:00`, assignedTo: person, basedAt: base,
  }));
}

// Weekdays of the anchor week (Mon–Fri, offsets 0–4).
const WD: readonly string[] = [ymd(0), ymd(1), ymd(2), ymd(3), ymd(4)];
// Full week (Mon–Sun, offsets 0–6).
const W1: readonly string[] = [...WD, ymd(5), ymd(6)];

// ── Dispatch shifts ───────────────────────────────────────────────────────────

export const dispatchShifts: DemoEvent[] = [
  // Seattle hub — 7 days day + night
  ...dayShifts  ('ds-marcus', 'Dispatch Day',   'emp-marcus', 'b-seattle',  W1, 'dispatch-shift'),
  ...nightShifts('ds-diane',  'Dispatch Night', 'emp-diane',  'b-seattle',  W1, 'dispatch-shift'),
  // Portland — weekdays day only
  ...dayShifts  ('ds-ryan',   'Dispatch Day',   'emp-ryan',   'b-portland', WD, 'dispatch-shift'),
  // Denver hub — 7 days day + night
  ...dayShifts  ('ds-lisa',   'Dispatch Day',   'emp-lisa',   'b-denver',   W1, 'dispatch-shift'),
  ...nightShifts('ds-tom',    'Dispatch Night', 'emp-tom',    'b-denver',   W1, 'dispatch-shift'),
  // Salt Lake — weekdays day only
  ...dayShifts  ('ds-ana',    'Dispatch Day',   'emp-ana',    'b-slc',      WD, 'dispatch-shift'),
];

// ── Pilot shifts ──────────────────────────────────────────────────────────────
// James and Elena are on the mission Fri (offset 4), so their shifts end Thu (offset 3).

const WD_PRE_MISSION: readonly string[] = [ymd(0), ymd(1), ymd(2), ymd(3)];

export const pilotShifts: DemoEvent[] = [
  ...dayShifts  ('ps-james',  'Pilot Day',   'emp-james',  'b-seattle',  WD_PRE_MISSION, 'pilot-shift'),
  ...nightShifts('ps-priya',  'Pilot Night', 'emp-priya',  'b-seattle',  WD,             'pilot-shift'),
  ...dayShifts  ('ps-derek',  'Pilot Day',   'emp-derek',  'b-portland', WD_PRE_MISSION, 'pilot-shift'),
  ...dayShifts  ('ps-elena',  'Pilot Day',   'emp-elena',  'b-denver',   WD_PRE_MISSION, 'pilot-shift'),
  ...nightShifts('ps-kevin',  'Pilot Night', 'emp-kevin',  'b-denver',   WD,             'pilot-shift'),
  ...dayShifts  ('ps-dana',   'Pilot Day',   'emp-dana',   'b-slc',      WD,             'pilot-shift'),
];

// ── Medical shifts ────────────────────────────────────────────────────────────

export const medicalShifts: DemoEvent[] = [
  ...dayShifts  ('ms-keely',  'Medical Day',   'emp-keely',  'b-seattle',  WD_PRE_MISSION, 'medical-shift'),
  ...nightShifts('ms-alex',   'Medical Night', 'emp-alex',   'b-seattle',  WD_PRE_MISSION, 'medical-shift'),
  ...dayShifts  ('ms-jordan', 'Medical Day',   'emp-jordan', 'b-portland', WD,             'medical-shift'),
  ...dayShifts  ('ms-nina',   'Medical Day',   'emp-nina',   'b-denver',   WD,             'medical-shift'),
  ...nightShifts('ms-david',  'Medical Night', 'emp-david',  'b-denver',   WD,             'medical-shift'),
  // Grace Taylor — PTO Mon/Tue, day shifts Wed–Fri
  ...dayShifts  ('ms-grace',  'Medical Day',   'emp-grace',  'b-slc',      [ymd(2), ymd(3), ymd(4)], 'medical-shift'),
];

// ── Mechanic shifts ───────────────────────────────────────────────────────────

export const mechanicShifts: DemoEvent[] = [
  ...dayShifts('mech-sarah', 'Mechanic Day', 'emp-sarah', 'b-denver', WD, 'mechanic-shift'),
];

// ── On-call rotation (week-long blocks) ───────────────────────────────────────

export const mechanicOnCall: DemoEvent[] = [
  { id: 'oc-mike-w1',  title: 'On Call – Week A', category: 'on-call', visualPriority: 'muted', start: dt(0,  '00:00'), end: dt(7,  '00:00'), assignedTo: 'emp-mike',  basedAt: 'b-seattle' },
  { id: 'oc-sarah-w2', title: 'On Call – Week B', category: 'on-call', visualPriority: 'muted', start: dt(7,  '00:00'), end: dt(14, '00:00'), assignedTo: 'emp-sarah', basedAt: 'b-denver'  },
  { id: 'oc-sam-w1',   title: 'On Call – Week A', category: 'on-call', visualPriority: 'muted', start: dt(0,  '00:00'), end: dt(7,  '00:00'), assignedTo: 'emp-sam',   basedAt: 'b-seattle' },
  { id: 'oc-grace-w2', title: 'On Call – Week B', category: 'on-call', visualPriority: 'muted', start: dt(7,  '00:00'), end: dt(14, '00:00'), assignedTo: 'emp-grace', basedAt: 'b-slc'     },
  { id: 'oc-cody-w1',  title: 'On Call – Week A', category: 'on-call', visualPriority: 'muted', start: dt(0,  '00:00'), end: dt(7,  '00:00'), assignedTo: 'emp-cody',  basedAt: 'b-bozeman' },
];

import type { DemoMissionRequest } from './types';

// ── PTO ───────────────────────────────────────────────────────────────────────

export const ptoEvents: DemoEvent[] = [
  { id: 'pto-derek', title: 'PTO – Derek Mills',  category: 'pto', visualPriority: 'muted', start: dt(4, '00:00'), end: dt(6, '00:00'), assignedTo: 'emp-derek', basedAt: 'b-portland' },
  { id: 'pto-grace', title: 'PTO – Grace Taylor', category: 'pto', visualPriority: 'muted', start: dt(0, '00:00'), end: dt(2, '00:00'), assignedTo: 'emp-grace', basedAt: 'b-slc'      },
];

// ── Maintenance ───────────────────────────────────────────────────────────────

export const maintenanceEvents: DemoEvent[] = [
  { id: 'maint-n806ec', title: 'Scheduled Inspection – EC135 N806EC', category: 'maintenance', visualPriority: 'high',  start: dt(1, '08:00'), end: dt(4, '17:00'), assignedTo: 'ac-n806ec', basedAt: 'b-bozeman' },
  { id: 'maint-n803lj', title: 'Pre-Mission Check – Learjet N803LJ',  category: 'maintenance', visualPriority: 'high',  start: dt(2, '07:00'), end: dt(3, '12:00'), assignedTo: 'ac-n803lj', basedAt: 'b-seattle'  },
];

// ── Training ──────────────────────────────────────────────────────────────────

export const trainingEvents: DemoEvent[] = [
  { id: 'trn-cody', title: 'IFR Recurrent – Cody Barnes',    category: 'training', visualPriority: 'muted', start: dt(3, '09:00'), end: dt(3, '15:00'), assignedTo: 'emp-cody',  basedAt: 'b-bozeman' },
  { id: 'trn-sam',  title: 'ECMO Recertification – Sam Nguyen', category: 'training', visualPriority: 'muted', start: dt(2, '08:00'), end: dt(2, '16:00'), assignedTo: 'emp-sam',   basedAt: 'b-seattle'  },
];

// ── Aircraft + asset requests ─────────────────────────────────────────────────

export const requests: DemoEvent[] = [
  { id: 'req-n803lj', title: 'Lift Request – N803LJ (International Mission)', category: 'aircraft-request', visualPriority: 'high',  start: dt(3, '08:00'), end: dt(3, '17:00'), assignedTo: 'ac-n803lj', basedAt: 'b-seattle'  },
  { id: 'req-nicu',   title: 'NICU Equipment Check – AW139 N801AW',            category: 'asset-request',    visualPriority: 'muted', start: dt(4, '09:00'), end: dt(4, '11:00'), assignedTo: 'ac-n801aw', basedAt: 'b-seattle'  },
];

// ── Base events ───────────────────────────────────────────────────────────────

export const baseEvents: DemoEvent[] = [
  { id: 'base-sea-allhands', title: 'Seattle All-Hands',        category: 'base-event', visualPriority: 'muted', start: dt(1, '08:00'), end: dt(1, '09:00'), basedAt: 'b-seattle' },
  { id: 'base-sea-brief',    title: 'Pre-Mission Briefing',     category: 'base-event', visualPriority: 'high',  start: dt(3, '14:00'), end: dt(3, '15:30'), basedAt: 'b-seattle' },
  { id: 'base-den-standup',  title: 'Denver Crew Standup',      category: 'base-event', visualPriority: 'muted', start: dt(1, '07:30'), end: dt(1, '08:00'), basedAt: 'b-denver'  },
];

// ── International mission ─────────────────────────────────────────────────────

const MISSION_TITLE = 'São Paulo → Munich Critical Care Transfer';

export const mission: DemoMissionRequest = {
  id: 'mission-sao-muc',
  title: MISSION_TITLE,
  start: dt(4, '06:00'),
  end:   dt(8, '08:00'),
  // São Paulo / Guarulhos (GRU) — pickup point for the patient transfer.
  originCoords: { lat: -23.4356, lon: -46.4731 },
  requirements: {
    aircraft: { minHoursRemaining: 30, requiredCapabilities: ['IFR', 'International', 'Critical Care'] },
    crew: {
      pilots:  { count: 4, certifications: ['IFR', 'International'] },
      medical: [
        { role: 'RN', certifications: ['Critical Care'] },
        { role: 'RT', certifications: ['Vent'] },
      ],
    },
    durationDays: 4,
  },
  assignments: {
    pilots:  [
      { resourceId: 'emp-james',  resourceType: 'pilot' },
      { resourceId: 'emp-elena',  resourceType: 'pilot' },
      { resourceId: 'emp-priya',  resourceType: 'pilot' },
      { resourceId: 'emp-kevin',  resourceType: 'pilot' },
    ],
    medical: [
      { resourceId: 'emp-keely', resourceType: 'medical' },
      { resourceId: 'emp-alex',  resourceType: 'medical' },
    ],
    aircraft: { resourceId: 'ac-n803lj', resourceType: 'aircraft' },
  },
  legs: [
    { id: 'leg-1', from: 'São Paulo (GRU)', to: 'New York (JFK)', start: dt(4, '06:00'), end: dt(4, '14:00') },
    { id: 'leg-2', from: 'New York (JFK)',  to: 'London (LHR)',   start: dt(4, '16:00'), end: dt(5, '06:00') },
    { id: 'leg-3', from: 'London (LHR)',    to: 'Munich (MUC)',   start: dt(5, '08:00'), end: dt(5, '11:00') },
    { id: 'leg-4', from: 'Munich (MUC)',    to: 'Seattle (SEA)',  start: dt(7, '10:00'), end: dt(8, '08:00') },
  ],
  compliance: [
    { id: 'comp-1', label: 'Brazil Exit Clearance',       status: 'approved' },
    { id: 'comp-2', label: 'Portugal Overflight Permit',  status: 'approved' },
    { id: 'comp-3', label: 'Germany Entry Clearance',     status: 'pending'  },
    { id: 'comp-4', label: 'Medical Capability Verified', status: 'approved' },
    { id: 'comp-5', label: 'Duty-Time Compliance',        status: 'pending'  },
  ],
};

// Mission calendar events — one aircraft event covering the full mission
// window plus full-window crew "shift-kind" events. The aircraft event has
// no meta.kind, so it surfaces in Month/Week as one continuous mission bar.
// Crew events are tagged kind: 'shift' so the library's viewScope filters
// them out of Month/Week (they'd otherwise stack as 6 overlapping multi-day
// pills) — they still appear in Schedule and the Crew-on-shift surfaces
// because the kind correctly marks them as active staffing.
export const missionEvents: DemoEvent[] = [
  // Aircraft — single span for the whole mission window
  {
    id: 'mission-ac-window',
    title: MISSION_TITLE,
    category: 'mission-assignment' as const,
    visualPriority: 'high' as const,
    start: mission.start, end: mission.end,
    assignedTo: 'ac-n803lj', basedAt: 'b-seattle',
  },
  // Assigned crew covering the full mission window. `meta.kind: 'shift'`
  // hides them from Month/Week noise but keeps them visible in Schedule.
  ...mission.assignments.pilots.map(p => ({
    id: `mission-pilot-${p.resourceId}`,
    title: MISSION_TITLE,
    category: 'mission-assignment' as const,
    visualPriority: 'high' as const,
    start: mission.start, end: mission.end,
    assignedTo: p.resourceId, basedAt: 'b-seattle',
    meta: { kind: 'shift' as const },
  })),
  ...mission.assignments.medical.map(m => ({
    id: `mission-med-${m.resourceId}`,
    title: MISSION_TITLE,
    category: 'mission-assignment' as const,
    visualPriority: 'high' as const,
    start: mission.start, end: mission.end,
    assignedTo: m.resourceId, basedAt: 'b-seattle',
    meta: { kind: 'shift' as const },
  })),
];

// ── Flat composite export ─────────────────────────────────────────────────────

export const allEvents: DemoEvent[] = [
  ...dispatchShifts,
  ...pilotShifts,
  ...medicalShifts,
  ...mechanicShifts,
  ...mechanicOnCall,
  ...ptoEvents,
  ...maintenanceEvents,
  ...trainingEvents,
  ...requests,
  ...baseEvents,
  ...missionEvents,
];
