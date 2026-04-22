/**
 * Mission requirement and assignment types.
 *
 * Used by:
 *   - Sprint 5: Mission request workflow (hover card, slot assignment, validation)
 *   - demo/types.ts: DemoMissionRequest
 */

// ── Requirement slot types ────────────────────────────────────────────────────

export interface PilotRequirement {
  count: number;
  certifications: string[];
}

export interface MedicalSlot {
  role: string;
  certifications: string[];
}

export interface AircraftRequirement {
  minHoursRemaining: number;
  requiredCapabilities?: string[];
}

export interface MissionRequirements {
  aircraft: AircraftRequirement;
  crew: {
    pilots: PilotRequirement;
    medical: MedicalSlot[];
  };
  durationDays: number;
}

// ── Assignment types ──────────────────────────────────────────────────────────

export type AssignedResourceType = 'pilot' | 'medical' | 'aircraft';

export interface AssignedResource {
  resourceId: string;
  resourceType: AssignedResourceType;
}

export interface MissionAssignments {
  pilots: AssignedResource[];
  medical: AssignedResource[];
  aircraft: AssignedResource | null;
}

// ── Validation types ──────────────────────────────────────────────────────────

/** Per-slot validation result rendered as ✅ met / ⚠ partial / ❌ unmet. */
export type RequirementStatus = 'met' | 'partial' | 'unmet';

export interface RequirementValidation {
  pilots: RequirementStatus;
  /** One entry per MedicalSlot in MissionRequirements.crew.medical. */
  medical: RequirementStatus[];
  aircraft: RequirementStatus;
}
