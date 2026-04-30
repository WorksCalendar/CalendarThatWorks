/**
 * JSON-safe record interfaces for the Air EMS demo dataset.
 *
 * All fields are plain JSON primitives (string, number, boolean, string[]).
 * No Date objects, Maps, Sets, or class instances — data must be
 * serializable and usable in JSON config/data flows.
 *
 * Used by demo/emsData.ts (Sprint 4) and demo/App.tsx.
 */

import type { EventCategory, EventVisualPriority } from '../src/types/view';
import type { MissionRequirements, MissionAssignments } from '../src/types/mission';

// ── Personnel ─────────────────────────────────────────────────────────────────

export type DemoEmployeeRole =
  | 'dispatcher'
  | 'pilot'
  | 'rn'
  | 'rt'
  | 'medic'
  | 'mechanic';

export type DemoShiftType = 'day' | 'night' | 'on-call';

export type DemoDutyStatus = 'on-duty' | 'off-duty' | 'on-call';

export interface DemoEmployee {
  id: string;
  name: string;
  role: DemoEmployeeRole;
  certifications: string[];
  shiftType: DemoShiftType;
  dutyStatus: DemoDutyStatus;
  basedAt: string;
}

// ── Aircraft ──────────────────────────────────────────────────────────────────

export type DemoAircraftType = 'helicopter' | 'fixed-wing';

export type DemoAircraftStatus = 'available' | 'maintenance' | 'assigned';

export interface DemoAircraft {
  id: string;
  tail: string;
  name: string;
  type: DemoAircraftType;
  hoursRemaining: number;
  basedAt: string;
  capabilities: string[];
  status: DemoAircraftStatus;
}

// ── Geography ─────────────────────────────────────────────────────────────────

export interface DemoRegion {
  id: string;
  name: string;
}

export interface DemoBase {
  id: string;
  name: string;
  regionId: string;
}

// ── Events ────────────────────────────────────────────────────────────────────

export interface DemoEvent {
  id: string;
  title: string;
  /** ISO 8601 string — no Date objects. */
  start: string;
  /** ISO 8601 string — no Date objects. */
  end: string;
  category: EventCategory;
  visualPriority: EventVisualPriority;
  /** Employee id, aircraft id, or base id this event belongs to. */
  assignedTo?: string;
  basedAt?: string;
}

// ── Mission request ───────────────────────────────────────────────────────────

export interface DemoMissionLeg {
  id: string;
  from: string;
  to: string;
  start: string;
  end: string;
}

export type DemoComplianceStatus = 'approved' | 'pending' | 'rejected';

export interface DemoComplianceItem {
  id: string;
  label: string;
  status: DemoComplianceStatus;
}

export interface DemoMissionRequest {
  id: string;
  title: string;
  start: string;
  end: string;
  requirements: MissionRequirements;
  assignments: MissionAssignments;
  legs: DemoMissionLeg[];
  compliance: DemoComplianceItem[];
  /** Optional pickup coordinates so DispatchView can rank bases by distance. */
  originCoords?: { lat: number; lon: number };
}
