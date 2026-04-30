/**
 * demo/walkthrough/reducer.test.ts — pure state machine tests.
 *
 * Validates the four action types (observe / advance / restart / exit) drive
 * the right transitions across every step. The reducer has no React or DOM
 * dependencies, so we exercise it directly with synthetic events.
 */

import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, reducer, type ReducerDeps } from './reducer';
import { STEPS } from './steps';
import type { StepContext, WalkthroughEvent } from './types';

const CTX: StepContext = {
  alphaEventId: 'wt-alpha',
  bravoEventId: 'wt-bravo',
  bravoResource: 'ac-n804aw',
  alphaInitialResource: 'ac-n801aw',
  alphaInitialStartIso: '2026-04-23T14:00:00',
};

const DEPS: ReducerDeps = { steps: STEPS, ctx: CTX };

const moved = (eventId: string): WalkthroughEvent => ({
  kind: 'event-moved',
  eventId,
  previousResource: CTX.alphaInitialResource,
  previousStartIso: '2026-04-23T14:00:00',
});

const reassigned = (toResource: string | null): WalkthroughEvent => ({
  kind: 'event-reassigned',
  eventId: CTX.alphaEventId,
  toResource,
});

const conflict: WalkthroughEvent = {
  kind: 'conflict-detected',
  eventId: CTX.alphaEventId,
  conflictingEventId: CTX.bravoEventId,
};

const view = (v: string): WalkthroughEvent => ({ kind: 'view-changed', view: v });

describe('walkthrough reducer', () => {
  it('starts at move-job in guided mode', () => {
    expect(INITIAL_STATE.currentStep).toBe('move-job');
    expect(INITIAL_STATE.mode).toBe('guided');
    expect(INITIAL_STATE.history).toEqual([]);
  });

  it('advances through the full happy path on matching observations', () => {
    let state = INITIAL_STATE;
    state = reducer(state, { type: 'observe', event: moved(CTX.alphaEventId) }, DEPS);
    expect(state.currentStep).toBe('cause-conflict');

    state = reducer(state, { type: 'observe', event: conflict }, DEPS);
    expect(state.currentStep).toBe('fix-conflict');

    state = reducer(state, { type: 'observe', event: reassigned('ac-n802ec') }, DEPS);
    expect(state.currentStep).toBe('switch-view');

    state = reducer(state, { type: 'observe', event: view('schedule') }, DEPS);
    expect(state.currentStep).toBe('open-map');

    state = reducer(state, { type: 'observe', event: view('map') }, DEPS);
    expect(state.currentStep).toBe('done');

    expect(state.history).toEqual([
      'move-job', 'cause-conflict', 'fix-conflict', 'switch-view', 'open-map',
    ]);
    expect(state.bootstrapping).toBe(false);
  });

  it('ignores observations that do not match the current step', () => {
    const stateA = reducer(INITIAL_STATE, { type: 'observe', event: view('schedule') }, DEPS);
    expect(stateA.currentStep).toBe('move-job');

    const stateB = reducer(INITIAL_STATE, { type: 'observe', event: moved('some-other-event') }, DEPS);
    expect(stateB.currentStep).toBe('move-job');
  });

  it('treats fix-conflict reassign back to bravo as not yet resolved', () => {
    let state = INITIAL_STATE;
    state = reducer(state, { type: 'observe', event: moved(CTX.alphaEventId) }, DEPS);
    state = reducer(state, { type: 'observe', event: conflict }, DEPS);
    expect(state.currentStep).toBe('fix-conflict');

    // Reassigning back onto the same conflicting resource should NOT advance.
    state = reducer(state, { type: 'observe', event: reassigned(CTX.bravoResource) }, DEPS);
    expect(state.currentStep).toBe('fix-conflict');

    // Any other resource clears it.
    state = reducer(state, { type: 'observe', event: reassigned('ac-n802ec') }, DEPS);
    expect(state.currentStep).toBe('switch-view');
  });

  it('manual advance jumps forward without an observation', () => {
    const next = reducer(INITIAL_STATE, { type: 'advance' }, DEPS);
    expect(next.currentStep).toBe('cause-conflict');
    expect(next.history).toEqual(['move-job']);
  });

  it('does not advance past done', () => {
    const done = { ...INITIAL_STATE, currentStep: 'done' as const };
    expect(reducer(done, { type: 'advance' }, DEPS)).toEqual(done);
    expect(reducer(done, { type: 'observe', event: moved(CTX.alphaEventId) }, DEPS)).toEqual(done);
  });

  it('exit switches to free-play and ignores subsequent observations', () => {
    let state = reducer(INITIAL_STATE, { type: 'exit' }, DEPS);
    expect(state.mode).toBe('free-play');
    state = reducer(state, { type: 'observe', event: moved(CTX.alphaEventId) }, DEPS);
    expect(state.currentStep).toBe('move-job');
    expect(state.mode).toBe('free-play');
  });

  it('restart returns to the initial state from any mode', () => {
    const wandered = reducer(INITIAL_STATE, { type: 'advance' }, DEPS);
    const reset = reducer(wandered, { type: 'restart' }, DEPS);
    expect(reset).toEqual(INITIAL_STATE);

    const exited = reducer(INITIAL_STATE, { type: 'exit' }, DEPS);
    expect(reducer(exited, { type: 'restart' }, DEPS)).toEqual(INITIAL_STATE);
  });

  it('cause-conflict accepts either a conflict-detected or a reassign-onto-bravo event', () => {
    const afterMove = reducer(INITIAL_STATE, { type: 'observe', event: moved(CTX.alphaEventId) }, DEPS);
    expect(afterMove.currentStep).toBe('cause-conflict');

    const viaReassign = reducer(afterMove, { type: 'observe', event: reassigned(CTX.bravoResource) }, DEPS);
    expect(viaReassign.currentStep).toBe('fix-conflict');
  });

  it('open-map step accepts either map-widget-opened or view-changed:map', () => {
    const start = { ...INITIAL_STATE, currentStep: 'open-map' as const };
    const widget = reducer(start, { type: 'observe', event: { kind: 'map-widget-opened' } }, DEPS);
    expect(widget.currentStep).toBe('done');

    const viaView = reducer(start, { type: 'observe', event: view('map') }, DEPS);
    expect(viaView.currentStep).toBe('done');
  });
});
