/**
 * demo/walkthrough/steps.ts — the 6 guided steps + their match predicates.
 *
 * Each step is self-contained: banner copy, what to spotlight, and a pure
 * predicate that the reducer calls against every observed WalkthroughEvent.
 *
 * The flow mirrors the real operator workflow: a mission request lands on
 * the calendar (Month / Week), the scheduler moves it to a sensible slot,
 * then fills it with crew. The walkthrough teaches that:
 *
 *   1. move-mission   — drag the unassigned request to a new time
 *   2. assign-busy    — open it, assign Capt. James Wright (the busy pilot)
 *                       — engine flags overlap with his existing shift
 *   3. reassign-free  — pick any other pilot; conflict clears
 *   4. switch-view    — switch to Schedule view to see the assignment row
 *   5. open-map       — open the right-rail Region map mini-plot
 *   6. done           — terminal "you've got it" CTA
 */

import { WALKTHROUGH_MISSION_ID } from './fixtures';
import type { Step } from './types';

export const STEPS: readonly Step[] = [
  {
    id: 'move-mission',
    banner: {
      title: 'Move the mission request',
      body:  'A new mission request landed on the calendar. Drag it to a different time slot — or click in to fill the crew now.',
    },
    spotlight: { eventId: WALKTHROUGH_MISSION_ID },
    // Accept any first action on Mission Alpha — drag to a new time *or*
    // open the form and assign a pilot. Users who skip straight to
    // assignment aren't left stuck on Step 1; the assign step's matcher
    // handles its own filter (toResource === conflictPilotId), so an
    // assign here naturally falls through.
    matches: (event, ctx) =>
      (event.kind === 'mission-moved' || event.kind === 'mission-assigned')
      && event.eventId === ctx.missionEventId,
    hint: 'Click and hold the highlighted "Mission Alpha" request, then drag it to another hour or day. Or click into it to assign crew right away.',
  },

  {
    id: 'assign-busy',
    banner: {
      title: 'Assign a pilot — and watch what happens',
      body:  'Click Mission Alpha and assign Capt. James Wright. He\'s already on shift at that time, so the calendar will flag the conflict — click "Proceed anyway" on the prompt to keep going.',
    },
    spotlight: { eventId: WALKTHROUGH_MISSION_ID },
    matches: (event, ctx) =>
      event.kind === 'mission-assigned'
      && event.eventId === ctx.missionEventId
      && event.toResource === ctx.conflictPilotId,
    hint: 'Click the mission, set the resource to Capt. James Wright in the form, save — when the conflict prompt appears, click "Proceed anyway" to commit the assignment.',
  },

  {
    id: 'reassign-free',
    banner: {
      title: 'Resolve the conflict',
      body:  'Reassign Mission Alpha to any other pilot — the conflict clears.',
    },
    spotlight: { eventId: WALKTHROUGH_MISSION_ID },
    // mission-assignment events accept assets too, but the next step promises
    // a result on the *pilot's* row in Schedule view — asset rows aren't a
    // thing in Schedule view, which would leave users stuck. Restrict to
    // pilot reassignments only.
    matches: (event, ctx) =>
      event.kind === 'mission-assigned'
      && event.eventId === ctx.missionEventId
      && event.toResource !== null
      && event.toResource !== ctx.conflictPilotId
      && ctx.pilotIds.has(event.toResource),
    hint: 'Click the mission again, pick a different pilot in the form, save.',
  },

  {
    id: 'switch-view',
    banner: {
      title: 'See it as a schedule',
      body:  'Switch to the Schedule view in the toolbar — the mission now sits on its assigned pilot\'s row.',
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
      body:  'Click the Region map mini-plot in the right rail to expand it. Resource locations show at a glance.',
    },
    spotlight: { selector: '[data-wc-map-widget="peek"]' },
    matches: (event) =>
      event.kind === 'map-widget-opened'
      || (event.kind === 'view-changed' && event.view === 'map'),
    hint: 'Look for the "Region map" preview in the right rail — click it to expand.',
  },

  {
    id: 'done',
    banner: {
      title: 'You\'ve got it.',
      body:  'WorksCalendar manages requests, conflicts, and crew assignment — not just events. Explore on your own, or restart the tour anytime.',
    },
    matches: () => false,
  },
];
