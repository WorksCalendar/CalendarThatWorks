/**
 * demo/walkthrough/reducer.test.ts — pure state machine tests.
 *
 * Validates the four action types (observe / advance / restart / exit) drive
 * the right transitions across every step. The reducer has no React or DOM
 * dependencies, so we exercise it directly with synthetic events.
 *
 * Flow under test (matches steps.ts):
 *   move-mission → assign-busy → reassign-free → switch-view → open-map → done
 */

import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, reducer, type ReducerDeps } from './reducer';
import { STEPS } from './steps';
import type { StepContext, WalkthroughEvent } from './types';

const CTX: StepContext = {
  missionEventId:         'wt-mission',
  conflictPilotId:        'emp-james',
  missionInitialStartIso: '2026-04-23T14:00:00',
  pilotIds:               new Set(['emp-james', 'emp-priya', 'emp-derek']),
};

const DEPS: ReducerDeps = { steps: STEPS, ctx: CTX };

const moved = (eventId: string): WalkthroughEvent => ({
  kind: 'mission-moved',
  eventId,
  previousStartIso: CTX.missionInitialStartIso,
});

const assigned = (
  toResource: string | null,
  previousResource: string | null = null,
): WalkthroughEvent => ({
  kind: 'mission-assigned',
  eventId: CTX.missionEventId,
  previousResource,
  toResource,
});

const view = (v: string): WalkthroughEvent => ({ kind: 'view-changed', view: v });

describe('walkthrough reducer', () => {
  it('starts at move-mission in guided mode', () => {
    expect(INITIAL_STATE.currentStep).toBe('move-mission');
    expect(INITIAL_STATE.mode).toBe('guided');
    expect(INITIAL_STATE.history).toEqual([]);
  });

  it('advances through the full happy path on matching observations', () => {
    let state = INITIAL_STATE;
    state = reducer(state, { type: 'observe', event: moved(CTX.missionEventId) }, DEPS);
    expect(state.currentStep).toBe('assign-busy');

    // null → conflictPilot triggers Step 2.
    state = reducer(state, { type: 'observe', event: assigned(CTX.conflictPilotId, null) }, DEPS);
    expect(state.currentStep).toBe('reassign-free');

    // conflictPilot → some other pilot triggers Step 3.
    state = reducer(state, { type: 'observe', event: assigned('emp-priya', CTX.conflictPilotId) }, DEPS);
    expect(state.currentStep).toBe('switch-view');

    state = reducer(state, { type: 'observe', event: view('schedule') }, DEPS);
    expect(state.currentStep).toBe('open-map');

    state = reducer(state, { type: 'observe', event: view('map') }, DEPS);
    expect(state.currentStep).toBe('done');

    expect(state.history).toEqual([
      'move-mission', 'assign-busy', 'reassign-free', 'switch-view', 'open-map',
    ]);
    expect(state.bootstrapping).toBe(false);
  });

  it('ignores observations that do not match the current step', () => {
    const stateA = reducer(INITIAL_STATE, { type: 'observe', event: view('schedule') }, DEPS);
    expect(stateA.currentStep).toBe('move-mission');

    const stateB = reducer(INITIAL_STATE, { type: 'observe', event: moved('some-other-event') }, DEPS);
    expect(stateB.currentStep).toBe('move-mission');
  });

  it('move-mission also advances on a mission-assigned event (not just move)', () => {
    // W2: a user who clicks Mission Alpha and assigns a pilot directly,
    // skipping the drag, should not be left stuck on Step 1.
    const state = reducer(
      INITIAL_STATE,
      { type: 'observe', event: assigned('emp-priya', null) },
      DEPS,
    );
    expect(state.currentStep).toBe('assign-busy');
  });

  it('cascades through multiple steps a single event satisfies', () => {
    // Pathological-but-realistic case: user assigns to the conflict pilot
    // directly on first action. The mission-assigned event matches both
    // move-mission (any first action on the mission) AND assign-busy
    // (toResource is the conflict pilot). Without cascading the user
    // would land on assign-busy with the action they just performed
    // already complete — banner would read "now do the thing you did".
    const state = reducer(
      INITIAL_STATE,
      { type: 'observe', event: assigned(CTX.conflictPilotId, null) },
      DEPS,
    );
    expect(state.currentStep).toBe('reassign-free');
    expect(state.history).toEqual(['move-mission', 'assign-busy']);
  });

  it('assign-busy only advances when the mission is assigned to the conflict pilot', () => {
    let state = INITIAL_STATE;
    state = reducer(state, { type: 'observe', event: moved(CTX.missionEventId) }, DEPS);
    expect(state.currentStep).toBe('assign-busy');

    // Assigning to a different pilot during step 2 must NOT advance — the
    // teaching moment is specifically "you tried to schedule a busy pilot".
    state = reducer(state, { type: 'observe', event: assigned('emp-priya', null) }, DEPS);
    expect(state.currentStep).toBe('assign-busy');

    // Now actually assigning to the conflict pilot advances.
    state = reducer(state, { type: 'observe', event: assigned(CTX.conflictPilotId, 'emp-priya') }, DEPS);
    expect(state.currentStep).toBe('reassign-free');
  });

  it('reassign-free does not advance if user picks the conflict pilot again', () => {
    let state = INITIAL_STATE;
    state = reducer(state, { type: 'observe', event: moved(CTX.missionEventId) }, DEPS);
    state = reducer(state, { type: 'observe', event: assigned(CTX.conflictPilotId, null) }, DEPS);
    expect(state.currentStep).toBe('reassign-free');

    // Reassigning back to the conflict pilot should NOT advance.
    state = reducer(state, { type: 'observe', event: assigned(CTX.conflictPilotId, CTX.conflictPilotId) }, DEPS);
    expect(state.currentStep).toBe('reassign-free');

    // Any other pilot clears it.
    state = reducer(state, { type: 'observe', event: assigned('emp-priya', CTX.conflictPilotId) }, DEPS);
    expect(state.currentStep).toBe('switch-view');
  });

  it('reassign-free does not advance on asset reassignments — only pilots', () => {
    // mission-assignment events accept assets too. The matcher must restrict
    // to pilot ids so users don't end up on Step 4 ("see it on the pilot's
    // row in Schedule view") having actually assigned to an aircraft.
    let state = INITIAL_STATE;
    state = reducer(state, { type: 'observe', event: moved(CTX.missionEventId) }, DEPS);
    state = reducer(state, { type: 'observe', event: assigned(CTX.conflictPilotId, null) }, DEPS);
    expect(state.currentStep).toBe('reassign-free');

    // Aircraft id is not in pilotIds → must not advance.
    state = reducer(state, { type: 'observe', event: assigned('ac-n801aw', CTX.conflictPilotId) }, DEPS);
    expect(state.currentStep).toBe('reassign-free');

    // Switching to a real pilot does advance.
    state = reducer(state, { type: 'observe', event: assigned('emp-derek', 'ac-n801aw') }, DEPS);
    expect(state.currentStep).toBe('switch-view');
  });

  it('manual advance jumps forward without an observation', () => {
    const next = reducer(INITIAL_STATE, { type: 'advance' }, DEPS);
    expect(next.currentStep).toBe('assign-busy');
    expect(next.history).toEqual(['move-mission']);
  });

  it('does not advance past done', () => {
    const done = { ...INITIAL_STATE, currentStep: 'done' as const };
    expect(reducer(done, { type: 'advance' }, DEPS)).toEqual(done);
    expect(reducer(done, { type: 'observe', event: moved(CTX.missionEventId) }, DEPS)).toEqual(done);
  });

  it('exit switches to free-play and ignores subsequent observations', () => {
    let state = reducer(INITIAL_STATE, { type: 'exit' }, DEPS);
    expect(state.mode).toBe('free-play');
    state = reducer(state, { type: 'observe', event: moved(CTX.missionEventId) }, DEPS);
    expect(state.currentStep).toBe('move-mission');
    expect(state.mode).toBe('free-play');
  });

  it('restart returns to the initial state from any mode', () => {
    const wandered = reducer(INITIAL_STATE, { type: 'advance' }, DEPS);
    const reset = reducer(wandered, { type: 'restart' }, DEPS);
    expect(reset).toEqual(INITIAL_STATE);

    const exited = reducer(INITIAL_STATE, { type: 'exit' }, DEPS);
    expect(reducer(exited, { type: 'restart' }, DEPS)).toEqual(INITIAL_STATE);
  });

  it('open-map step accepts either map-widget-opened or view-changed:map', () => {
    const start = { ...INITIAL_STATE, currentStep: 'open-map' as const };
    const widget = reducer(start, { type: 'observe', event: { kind: 'map-widget-opened' } }, DEPS);
    expect(widget.currentStep).toBe('done');

    const viaView = reducer(start, { type: 'observe', event: view('map') }, DEPS);
    expect(viaView.currentStep).toBe('done');
  });
});
