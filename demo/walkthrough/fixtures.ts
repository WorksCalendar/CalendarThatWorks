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
 * Anchored to "this week's Thursday" so the walkthrough tracks real time
 * the same way emsData does. Without this, returning visitors past Apr
 * 2026 would see the walkthrough seeds drift out of the visible window
 * (auto-nav can compensate but the rest of the dataset around the seeds
 * would be on completely different dates).
 */

import { addDays, format, startOfWeek } from 'date-fns';

export const WALKTHROUGH_MISSION_ID = 'wt-mission';
export const WALKTHROUGH_DECOY_SHIFT_ID = 'wt-decoy-shift';

/** The pilot whose shift overlaps the mission slot — Step 2 conflict target. */
export const CONFLICT_PILOT_ID = 'emp-james';

// Anchor the seed events to "this week's Thursday" using Sunday as the week
// start — matching WeekView's default weekStartDay. This ensures Mission Alpha
// lands in the week currently visible in Week view AND in the same calendar
// month shown by Month view, regardless of today's day-of-week.
const _WEEK_SUN = startOfWeek(new Date(), { weekStartsOn: 0 });
function _seedDt(dayOffset: number, time: string): string {
  return `${format(addDays(_WEEK_SUN, dayOffset), 'yyyy-MM-dd')}T${time}`;
}

// Thursday = Sunday + 4 (Sun=0, Mon=1, Tue=2, Wed=3, Thu=4)
export const ALPHA_INITIAL_START_ISO = _seedDt(4, '14:00:00');

const MISSION_END_ISO = _seedDt(4, '15:00:00');
const SHIFT_START_ISO = _seedDt(4, '13:00:00');
const SHIFT_END_ISO   = _seedDt(4, '17:00:00');

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
