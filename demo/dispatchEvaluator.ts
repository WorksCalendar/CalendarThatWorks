/**
 * Air EMS dispatch evaluator — translates the demo's `DemoMissionRequest`
 * shape into the readiness verdict the generic DispatchView expects.
 *
 * Library separation: the calendar package's DispatchView knows nothing
 * about pilots, certifications, aircraft capabilities, or hours
 * remaining. This file owns those Air EMS specifics and exposes a
 * `(assetId, missionId, asOf) → { crewReady, equipmentReady, missing[] }`
 * callback the host wires into the view.
 *
 * The evaluator runs the same predicate `MissionHoverCard` already uses
 * for assignment validation (`meetsAircraftReqs`) plus a "is there
 * enough qualified, unbooked crew at this aircraft's base?" check that
 * the modal didn't surface.
 */
import type { DemoAircraft, DemoEmployee, DemoMissionRequest } from './types';
import { meetsAircraftReqs } from './MissionHoverCard';

export type DispatchEvaluatorInput = {
  /** Whole fleet — looked up by id. */
  aircraft: DemoAircraft[];
  /** Pilots only (for cert matching against pilot slots). */
  pilots: DemoEmployee[];
  /** Medical crew only (for cert matching against medical slots). */
  medicalCrew: DemoEmployee[];
  /** Pending missions/requests indexed by id. */
  missionsById: Record<string, DemoMissionRequest>;
  /** Returns true if the given resource (employee or asset) is booked at `at`. */
  isBookedAt: (resourceId: string, at: Date) => boolean;
  /** Optional baseId → coordinates lookup so the verdict can rank by distance. */
  baseCoords?: Record<string, LatLon>;
};

export type ReadinessVerdict = {
  crewReady: boolean;
  equipmentReady: boolean;
  missing: string[];
  breakdown?: ReadonlyArray<{
    id?: string;
    kind: string;
    label: string;
    satisfied: boolean;
    severity?: 'hard' | 'soft';
    detail?: string;
  }>;
};

type LatLon = { lat: number; lon: number };

function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Build the (assetId, missionId, asOf) evaluator the DispatchView wants.
 * The `asOf` flows into `isBookedAt` so cert-qualified-but-busy crew are
 * correctly excluded — a pilot with the right tickets who's already on
 * a flight at the chosen moment can't fill this mission's slot.
 */
export function makeDispatchEvaluator(
  inputs: DispatchEvaluatorInput,
): (assetId: string, missionId: string, asOf: Date) => ReadinessVerdict {
  return (assetId, missionId, asOf) => {
    const mission = inputs.missionsById[missionId];
    if (!mission) {
      return { crewReady: false, equipmentReady: false, missing: ['Unknown mission'] };
    }
    const ac = inputs.aircraft.find(a => a.id === assetId);
    if (!ac) {
      return { crewReady: false, equipmentReady: false, missing: ['Not an aircraft'] };
    }

    const missing: string[] = [];

    // ── Equipment / aircraft checks ──────────────────────────────────
    const equipmentReady = meetsAircraftReqs(ac, mission);
    if (ac.hoursRemaining < mission.requirements.aircraft.minHoursRemaining) {
      missing.push(`Aircraft below ${mission.requirements.aircraft.minHoursRemaining}h remaining (has ${ac.hoursRemaining}h)`);
    }
    const reqCaps = mission.requirements.aircraft.requiredCapabilities ?? [];
    const missingCaps = reqCaps.filter(c => !ac.capabilities.includes(c));
    if (missingCaps.length > 0) {
      missing.push(`Aircraft missing capability: ${missingCaps.join(', ')}`);
    }

    // ── Crew checks at this aircraft's base ──────────────────────────
    const reqPilotCerts = mission.requirements.crew.pilots.certifications ?? [];
    const reqPilotCount = mission.requirements.crew.pilots.count;
    const qualifiedPilots = inputs.pilots.filter(p =>
      p.basedAt === ac.basedAt
      && !inputs.isBookedAt(String(p.id), asOf)
      && reqPilotCerts.every(c => p.certifications.includes(c)),
    );
    if (qualifiedPilots.length < reqPilotCount) {
      const certLabel = reqPilotCerts.length > 0 ? ` w/ ${reqPilotCerts.join('+')}` : '';
      missing.push(
        `Need ${reqPilotCount} pilot${reqPilotCount === 1 ? '' : 's'}${certLabel}; ${qualifiedPilots.length} ready at base`,
      );
    }

    let crewSlotsCovered = qualifiedPilots.length >= reqPilotCount;
    for (const slot of mission.requirements.crew.medical) {
      const qualified = inputs.medicalCrew.filter(m =>
        m.basedAt === ac.basedAt
        && !inputs.isBookedAt(String(m.id), asOf)
        && slot.certifications.every(c => m.certifications.includes(c)),
      );
      if (qualified.length === 0) {
        crewSlotsCovered = false;
        const certLabel = slot.certifications.length > 0 ? ` w/ ${slot.certifications.join('+')}` : '';
        missing.push(`No ${slot.role}${certLabel} ready at base`);
      }
    }

    // ── Distance from request origin (advertised "by location" view) ──
    const breakdown: NonNullable<ReadinessVerdict['breakdown']>[number][] = [];
    const origin = mission.originCoords;
    const baseLatLon = inputs.baseCoords?.[ac.basedAt];
    if (origin && baseLatLon) {
      const km = Math.round(haversineKm(baseLatLon, origin));
      const nm = Math.round(km * 0.539957);
      breakdown.push({
        id: 'distance',
        kind: 'distance',
        label: `${nm.toLocaleString()} nm from request origin`,
        satisfied: true,
        severity: 'soft',
        detail: `${km.toLocaleString()} km — base → pickup`,
      });
    }

    return { crewReady: crewSlotsCovered, equipmentReady, missing, breakdown };
  };
}
