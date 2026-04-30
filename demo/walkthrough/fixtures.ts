/**
 * demo/walkthrough/fixtures.ts — seed events the walkthrough injects on mount.
 *
 * Two mission-assignment events at the same time on different aircraft:
 *   - Alpha: the highlighted job the user manipulates through every step.
 *   - Bravo: a decoy on a different aircraft, occupying the same time slot
 *            so Step 2 ("drag onto another resource at the same time") lands
 *            on a guaranteed conflict.
 *
 * Aircraft picked because they have no other events on this date in
 * emsData.ts, so the conflict in Step 2 is solely caused by Alpha+Bravo.
 */

export const WALKTHROUGH_ALPHA_ID = 'wt-alpha';
export const WALKTHROUGH_BRAVO_ID = 'wt-bravo';

/** Aircraft id Alpha starts on. Free at this slot in emsData. */
export const ALPHA_INITIAL_RESOURCE = 'ac-n801aw';
/** Aircraft id Bravo parks on — Step 2 conflict target. */
export const BRAVO_RESOURCE = 'ac-n804aw';

export const ALPHA_INITIAL_START_ISO = '2026-04-23T14:00:00';
const SLOT_START = ALPHA_INITIAL_START_ISO;
const SLOT_END   = '2026-04-23T15:00:00';

const MISSION_COLOR = '#a855f7';

interface SeedEventInput {
  id: string;
  title: string;
  start: string;
  end: string;
  category: string;
  resource: string;
  color: string;
  meta?: Record<string, unknown>;
}

export function buildWalkthroughEvents(): SeedEventInput[] {
  return [
    {
      id: WALKTHROUGH_ALPHA_ID,
      title: 'Walkthrough · Mission Alpha',
      start: SLOT_START,
      end:   SLOT_END,
      category: 'mission-assignment',
      resource: ALPHA_INITIAL_RESOURCE,
      color: MISSION_COLOR,
      meta: { walkthroughRole: 'alpha' },
    },
    {
      id: WALKTHROUGH_BRAVO_ID,
      title: 'Walkthrough · Mission Bravo',
      start: SLOT_START,
      end:   SLOT_END,
      category: 'mission-assignment',
      resource: BRAVO_RESOURCE,
      color: MISSION_COLOR,
      meta: { walkthroughRole: 'bravo' },
    },
  ];
}
