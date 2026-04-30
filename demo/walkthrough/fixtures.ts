/**
 * demo/walkthrough/fixtures.ts — seed events the walkthrough injects on mount.
 *
 * Two seeded events that drive the "request → place → fill" workflow:
 *
 *   • Mission Alpha — an UNASSIGNED mission-assignment request. resource is
 *     null so the event renders as "Unassigned" in Week / Month / Day views
 *     (per WeekView.tsx:315 fallback). The walkthrough drags it to a new
 *     time, then assigns a pilot to it via the edit form.
 *
 *   • Decoy pilot shift — a pilot-shift event on emp-james at the same
 *     hour. Assigning Mission Alpha to emp-james therefore overlaps this
 *     shift and triggers the engine's soft conflict — that's the Step 2
 *     teaching moment ("you tried to schedule a busy pilot").
 *
 * The pilot id was chosen because emsData.ts has no other 14:00 events on
 * Capt. James Wright on Apr 23, so the conflict is solely caused by the
 * walkthrough seed.
 */

export const WALKTHROUGH_MISSION_ID = 'wt-mission';
export const WALKTHROUGH_DECOY_SHIFT_ID = 'wt-decoy-shift';

/** The pilot whose shift overlaps the mission slot — Step 2 conflict target. */
export const CONFLICT_PILOT_ID = 'emp-james';

export const ALPHA_INITIAL_START_ISO = '2026-04-23T14:00:00';

const MISSION_END_ISO = '2026-04-23T15:00:00';
const SHIFT_START_ISO = '2026-04-23T13:00:00';
const SHIFT_END_ISO   = '2026-04-23T17:00:00';

const MISSION_COLOR = '#a855f7';
const PILOT_COLOR   = '#3b82f6';

interface SeedEventInput {
  id: string;
  title: string;
  start: string;
  end: string;
  category: string;
  resource: string | null;
  color: string;
  visualPriority?: string;
  meta?: Record<string, unknown>;
}

export function buildWalkthroughEvents(): SeedEventInput[] {
  return [
    {
      id: WALKTHROUGH_MISSION_ID,
      title: 'Walkthrough · Mission Alpha (request)',
      start: ALPHA_INITIAL_START_ISO,
      end:   MISSION_END_ISO,
      category: 'mission-assignment',
      resource: null,
      color: MISSION_COLOR,
      visualPriority: 'high',
      meta: { walkthroughRole: 'mission' },
    },
    {
      id: WALKTHROUGH_DECOY_SHIFT_ID,
      title: 'Walkthrough · Capt. Wright shift',
      start: SHIFT_START_ISO,
      end:   SHIFT_END_ISO,
      category: 'pilot-shift',
      resource: CONFLICT_PILOT_ID,
      color: PILOT_COLOR,
      meta: { walkthroughRole: 'decoy-shift', kind: 'shift' },
    },
  ];
}
