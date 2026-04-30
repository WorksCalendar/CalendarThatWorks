/**
 * demo/walkthrough/types.ts — guided walkthrough state machine types.
 *
 * The walkthrough is strictly observational: it wraps the existing demo
 * callbacks (onEventMove, onConflictCheck, onViewChange, …), inspects each
 * event, and advances when the user performs the action the current step
 * is waiting for. It never replaces the demo's own behavior.
 */

export type StepId =
  | 'move-mission'    // Step 1: drag the unassigned mission request to a new time
  | 'assign-busy'     // Step 2: open the request and try to assign a busy pilot → conflict
  | 'reassign-free'   // Step 3: pick a different pilot → conflict clears
  | 'switch-view'     // Step 4: switch to schedule view to see the result on the pilot's row
  | 'open-map'        // Step 5: open the right-rail map widget
  | 'done';           // terminal: "now you get it" CTA

export type WalkthroughMode = 'guided' | 'free-play';

/**
 * Discriminated union of events the adapter layer pushes into the reducer.
 * Every step is an `expect` matcher over this union.
 */
export type WalkthroughEvent =
  | { kind: 'mission-moved'; eventId: string; previousStartIso: string }
  | { kind: 'mission-assigned'; eventId: string; previousResource: string | null; toResource: string | null }
  | { kind: 'view-changed'; view: string }
  | { kind: 'map-widget-opened' }
  | { kind: 'manual-advance' };

export interface StepBanner {
  title: string;
  body: string;
}

export interface StepSpotlight {
  /** Pulse the event with this id in the calendar grid. */
  eventId?: string;
  /** Or pulse the DOM node matching this CSS selector (toolbar buttons, etc.). */
  selector?: string;
}

export interface Step {
  id: StepId;
  banner: StepBanner;
  spotlight?: StepSpotlight;
  /** Predicate evaluated against each observed event; truthy → advance. */
  matches: (event: WalkthroughEvent, ctx: StepContext) => boolean;
  /** Hint copy shown after the user has been idle on this step. */
  hint?: string;
}

/**
 * Per-step context the reducer threads through `matches`. Lets steps
 * reference walkthrough-seeded ids without hard-coding strings into the
 * predicates.
 */
export interface StepContext {
  /** The unassigned mission request the user manipulates through every step. */
  missionEventId: string;
  /** Pilot id whose shift overlaps the mission slot — assigning the mission
   *  to this pilot is the Step 2 "you tried to schedule a busy pilot" moment. */
  conflictPilotId: string;
  /** Mission start at seed time; used to detect Step 1 (drag-to-new-time). */
  missionInitialStartIso: string;
  /** Set of pilot ids. Step 3 (reassign-free) only advances when the mission
   *  is reassigned to a pilot — mission-assignment events accept assets too,
   *  but Step 4 promises the result on the pilot's row in Schedule view, so
   *  asset reassignments would leave the user looking for a result that never
   *  appears. */
  pilotIds: ReadonlySet<string>;
}

export interface WalkthroughState {
  mode: WalkthroughMode;
  currentStep: StepId;
  /** Step ids the user has already cleared, oldest → newest. */
  history: StepId[];
  /** True between mount + first user gesture; suppresses the banner briefly. */
  bootstrapping: boolean;
}

export type WalkthroughAction =
  | { type: 'observe'; event: WalkthroughEvent }
  | { type: 'advance' }       // imperative "next" — used by manual-advance buttons
  | { type: 'restart' }       // jump back to the first step
  | { type: 'exit' };         // switch to free-play mode
