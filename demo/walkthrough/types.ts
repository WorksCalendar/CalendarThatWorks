/**
 * demo/walkthrough/types.ts — guided walkthrough state machine types.
 *
 * The walkthrough is strictly observational: it wraps the existing demo
 * callbacks (onEventMove, onConflictCheck, onViewChange, …), inspects each
 * event, and advances when the user performs the action the current step
 * is waiting for. It never replaces the demo's own behavior.
 */

export type StepId =
  | 'move-job'        // Step 1: drag highlighted event to a new time
  | 'cause-conflict'  // Step 2: drag it onto a resource that's already busy
  | 'fix-conflict'    // Step 3: reassign to a free resource
  | 'switch-view'     // Step 4: switch to schedule (timeline) view
  | 'open-map'        // Step 5: open the map widget (deferred — other branch)
  | 'done';           // terminal: "now you get it" CTA

export type WalkthroughMode = 'guided' | 'free-play';

/**
 * Discriminated union of events the adapter layer pushes into the reducer.
 * Every step is an `expect` matcher over this union.
 */
export type WalkthroughEvent =
  | { kind: 'event-moved'; eventId: string; previousResource: string | null; previousStartIso: string }
  | { kind: 'conflict-detected'; eventId: string; conflictingEventId: string }
  | { kind: 'event-reassigned'; eventId: string; toResource: string | null }
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
 * reference walkthrough-seeded ids (alpha, bravo, free resource) without
 * hard-coding strings into the predicates.
 */
export interface StepContext {
  alphaEventId: string;       // the highlighted event the user manipulates
  bravoEventId: string;       // the decoy that creates the Step 2 conflict
  bravoResource: string;      // aircraft id Bravo is parked on
  alphaInitialResource: string;
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
