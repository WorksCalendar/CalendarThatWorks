// demo/emsData.ts

import type {
  RegionRecord,
  BaseRecord,
  AssetRecord,
  PilotRecord,
  MedicalRecord,
  MechanicRecord,
  ShiftRecord,
  MaintenanceRecord,
  RequestRecord,
  MissionRecord,
} from './types';

/* ── Regions ───────────────────────────────────────── */

export const regions: RegionRecord[] = [
  { id: 'r1', name: 'Mountain' },
  { id: 'r2', name: 'Southwest' },
];

/* ── Bases ─────────────────────────────────────────── */

export const bases: BaseRecord[] = [
  { id: 'b1', name: 'Salt Lake', regionId: 'r1' },
  { id: 'b2', name: 'Logan', regionId: 'r1' },
  { id: 'b3', name: 'Phoenix', regionId: 'r2' },
];

/* ── Assets ────────────────────────────────────────── */

export const assets: AssetRecord[] = [
  {
    id: 'a1',
    name: 'Heli 1',
    type: 'helicopter',
    baseId: 'b1',
    capability: ['IFR', 'Night', 'Vent'],
    status: 'available',
  },
  {
    id: 'a2',
    name: 'Heli 2',
    type: 'helicopter',
    baseId: 'b2',
    capability: ['VFR'],
    status: 'maintenance',
  },
  {
    id: 'a3',
    name: 'Jet 1',
    type: 'fixed-wing',
    baseId: 'b1',
    capability: ['IFR', 'International', 'Critical Care'],
    status: 'assigned',
  },
];

/* ── Crew ─────────────────────────────────────────── */

export const crew: PilotRecord[] = [
  {
    id: 'c1',
    name: 'Pilot A',
    baseId: 'b1',
    certifications: ['IFR', 'Night'],
    dutyStatus: 'on-duty',
  },
  {
    id: 'c2',
    name: 'Pilot B',
    baseId: 'b1',
    certifications: ['IFR', 'International'],
    dutyStatus: 'on-duty',
  },
  {
    id: 'c3',
    name: 'Pilot C',
    baseId: 'b2',
    certifications: ['IFR'],
    dutyStatus: 'off-duty',
  },
];

export const medicalCrew: MedicalRecord[] = [
  {
    id: 'mc1',
    name: 'Nurse Kelly',
    baseId: 'b1',
    certifications: ['RN', 'Critical Care', 'Flight'],
    dutyStatus: 'on-duty',
  },
  {
    id: 'mc2',
    name: 'Respiratory Alex',
    baseId: 'b1',
    certifications: ['RT', 'Vent'],
    dutyStatus: 'on-duty',
  },
  {
    id: 'mc3',
    name: 'Medic Jordan',
    baseId: 'b2',
    certifications: ['Medic', 'Neonatal'],
    dutyStatus: 'off-duty',
  },
  {
    id: 'mc4',
    name: 'ECMO Specialist Sam',
    baseId: 'b1',
    certifications: ['RN', 'ECMO', 'International'],
    dutyStatus: 'on-call',
  },
];

export const mechanics: MechanicRecord[] = [
  { id: 'mech1', name: 'Tech Mike', baseId: 'b1', status: 'on-call' },
  { id: 'mech2', name: 'Tech Sarah', baseId: 'b2', status: 'off-duty' },
];

/* ── Shifts ───────────────────────────────────────── */

export const dispatchShifts: ShiftRecord[] = [
  {
    id: 'd1',
    title: 'Dispatch Day Shift',
    baseId: 'b1',
    start: '2026-04-21T07:00',
    end: '2026-04-21T19:00',
    type: 'dispatch',
  },
  {
    id: 'd2',
    title: 'Dispatch Night Shift',
    baseId: 'b1',
    start: '2026-04-21T19:00',
    end: '2026-04-22T07:00',
    type: 'dispatch',
  },
];

export const pilotShifts: ShiftRecord[] = [
  {
    id: 'ps1',
    title: 'Pilot Day Shift',
    crewId: 'c1',
    start: '2026-04-21T07:00',
    end: '2026-04-21T19:00',
    type: 'shift',
  },
  {
    id: 'ps2',
    title: 'Pilot Night Shift',
    crewId: 'c2',
    start: '2026-04-21T19:00',
    end: '2026-04-22T07:00',
    type: 'shift',
  },
];

export const medicalShifts: ShiftRecord[] = [
  {
    id: 'ms1',
    title: 'Medical Day Shift',
    crewId: 'mc1',
    start: '2026-04-21T07:00',
    end: '2026-04-21T19:00',
    type: 'shift',
  },
  {
    id: 'ms2',
    title: 'Medical Night Shift',
    crewId: 'mc2',
    start: '2026-04-21T19:00',
    end: '2026-04-22T07:00',
    type: 'shift',
  },
];

export const mechanicOnCall: ShiftRecord[] = [
  {
    id: 'oc1',
    title: 'On Call - Week A',
    crewId: 'mech1',
    start: '2026-04-20T00:00',
    end: '2026-04-27T00:00',
    type: 'on-call',
  },
  {
    id: 'oc2',
    title: 'On Call - Week B',
    crewId: 'mech2',
    start: '2026-04-27T00:00',
    end: '2026-05-04T00:00',
    type: 'on-call',
  },
];

/* ── Maintenance ───────────────────────────────────── */

export const maintenanceEvents: MaintenanceRecord[] = [
  {
    id: 'm1',
    title: '100hr Inspection - Heli 1',
    assetId: 'a1',
    start: '2026-04-22T08:00',
    end: '2026-04-22T14:00',
    type: 'maintenance',
  },
];

/* ── Requests ─────────────────────────────────────── */

export const requests: RequestRecord[] = [
  {
    id: 'req1',
    title: 'Training Flight Request',
    assetId: 'a1',
    status: 'pending',
    start: '2026-04-23T09:00',
    end: '2026-04-23T12:00',
    type: 'request',
  },
];

/* ── Mission (core demo scenario) ─────────────────── */

export const mission: MissionRecord = {
  id: 'mission1',
  name: 'Brazil → Germany Critical Care Transfer',
  requiredCrew: {
    pilots: ['IFR', 'International'],
    medical: ['Critical Care', 'Vent'],
  },
  legs: [
    {
      id: 'leg1',
      from: 'SLC',
      to: 'JFK',
      start: '2026-04-24T06:00',
      end: '2026-04-24T12:00',
    },
    {
      id: 'leg2',
      from: 'JFK',
      to: 'London',
      start: '2026-04-24T14:00',
      end: '2026-04-25T02:00',
    },
    {
      id: 'leg3',
      from: 'London',
      to: 'Germany',
      start: '2026-04-25T04:00',
      end: '2026-04-25T08:00',
    },
  ],
  assignments: {
    pilots: [
      { crewId: 'c1', legId: 'leg1' },
      { crewId: 'c2', legId: 'leg2' },
    ],
    medical: [
      { crewId: 'mc1', legId: 'leg1' },
      { crewId: 'mc2', legId: 'leg2' },
    ],
  },
  compliance: [
    { id: 'comp1', label: 'Brazil Exit Clearance', status: 'approved' },
    { id: 'comp2', label: 'UK Entry Clearance', status: 'approved' },
    { id: 'comp3', label: 'Germany Entry Clearance', status: 'pending' },
    { id: 'comp4', label: 'Medical Capability Verified', status: 'approved' },
  ],
};
