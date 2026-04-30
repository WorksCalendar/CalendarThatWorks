/**
 * demo/walkthrough/steps.ts — the 6 guided steps + their match predicates.
 *
 * Each step is self-contained: banner copy, what to spotlight, and a pure
 * predicate that the reducer calls against every observed WalkthroughEvent.
 *
 * Step order matches the spec in the demo-guided-walkthrough plan:
 *   1. move-job        — drag highlighted job to a new time
 *   2. cause-conflict  — drag it onto a busy resource → red highlight
 *   3. fix-conflict    — reassign to a free resource → conflict clears
 *   4. switch-view     — toolbar: switch to schedule (timeline)
 *   5. open-map        — open map widget (deferred; detection wired by the
 *                        map-widget branch when it lands)
 *   6. done            — terminal CTA ("Now you get it")
 */

import { WALKTHROUGH_ALPHA_ID } from './fixtures';
import type { Step } from './types';

export const STEPS: readonly Step[] = [
  {
    id: 'move-job',
    banner: {
      title: 'Move a job',
      body:  'Drag the highlighted mission to a new time on the calendar.',
    },
    spotlight: { eventId: WALKTHROUGH_ALPHA_ID },
    matches: (event, ctx) =>
      event.kind === 'event-moved' && event.eventId === ctx.alphaEventId,
    hint: 'Click and hold the highlighted "Mission Alpha" pill, then drag it to a different hour.',
  },

  {
    id: 'cause-conflict',
    banner: {
      title: 'Trigger a conflict',
      body:  'Now drag Mission Alpha onto Mission Bravo’s aircraft at the same time.',
    },
    spotlight: { eventId: WALKTHROUGH_ALPHA_ID },
    matches: (event, ctx) => {
      // A reassign onto Bravo's aircraft should immediately overlap Bravo.
      // We accept either signal — whichever the host emits first.
      if (event.kind === 'conflict-detected') {
        return event.eventId === ctx.alphaEventId
          && event.conflictingEventId === ctx.bravoEventId;
      }
      if (event.kind === 'event-reassigned') {
        return event.eventId === ctx.alphaEventId
          && event.toResource === ctx.bravoResource;
      }
      return false;
    },
    hint: 'Drag Mission Alpha onto Bravo’s row — they’ll overlap and the calendar will flag the conflict.',
  },

  {
    id: 'fix-conflict',
    banner: {
      title: 'Resolve the conflict',
      body:  'Reassign Mission Alpha to any other available aircraft.',
    },
    spotlight: { eventId: WALKTHROUGH_ALPHA_ID },
    matches: (event, ctx) =>
      event.kind === 'event-reassigned'
      && event.eventId === ctx.alphaEventId
      && event.toResource !== null
      && event.toResource !== ctx.bravoResource,
    hint: 'Drag Mission Alpha to a different aircraft row — anything except Bravo’s aircraft works.',
  },

  {
    id: 'switch-view',
    banner: {
      title: 'Switch to the schedule view',
      body:  'See the same data as a resource timeline. Use the view toggle in the toolbar.',
    },
    spotlight: { selector: '[data-wc-view-button="schedule"]' },
    matches: (event) =>
      event.kind === 'view-changed' && event.view === 'schedule',
    hint: 'Look for the view toggle in the calendar toolbar and pick "Schedule".',
  },

  {
    id: 'open-map',
    banner: {
      title: 'Bonus — See where your fleet is',
      body:  'Click the corner map peek to expand it. Resource locations show at a glance.',
    },
    spotlight: { selector: '[data-wc-map-widget="peek"]' },
    // Two emit paths: the dedicated MapPeekWidget (primary), or a host that
    // routes the legacy 'map' view as a fallback.
    matches: (event) =>
      event.kind === 'map-widget-opened'
      || (event.kind === 'view-changed' && event.view === 'map'),
    hint: 'Look for the small "Region map" tile in the corner of the calendar — click it to expand.',
  },

  {
    id: 'done',
    banner: {
      title: 'You’ve got it.',
      body:  'WorksCalendar manages resources, conflicts, and scheduling logic — not just events. Explore on your own, or restart the tour anytime.',
    },
    matches: () => false,
  },
];
