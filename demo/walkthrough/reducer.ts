/**
 * demo/walkthrough/reducer.ts — pure state machine.
 *
 * No React, no DOM, no localStorage. Given a state + action, returns the
 * next state. Tests poke at this directly to verify step ordering,
 * mismatched events stay on the current step, exit/restart shortcuts, etc.
 */

import type {
  Step,
  StepContext,
  StepId,
  WalkthroughAction,
  WalkthroughState,
} from './types';

export interface ReducerDeps {
  steps: readonly Step[];
  ctx: StepContext;
}

export const INITIAL_STATE: WalkthroughState = {
  mode: 'guided',
  currentStep: 'move-mission',
  history: [],
  bootstrapping: true,
};

function findStep(steps: readonly Step[], id: StepId): Step | undefined {
  return steps.find(s => s.id === id);
}

function nextStepId(steps: readonly Step[], current: StepId): StepId {
  const idx = steps.findIndex(s => s.id === current);
  if (idx < 0 || idx === steps.length - 1) return 'done';
  return steps[idx + 1]!.id;
}

export function reducer(
  state: WalkthroughState,
  action: WalkthroughAction,
  deps: ReducerDeps,
): WalkthroughState {
  // Free-play swallows every action except restart — the user opted out.
  if (state.mode === 'free-play' && action.type !== 'restart') return state;

  switch (action.type) {
    case 'observe': {
      // Cascade through consecutive matching steps. A single user gesture
      // can satisfy more than one step's matcher: e.g. clicking Mission
      // Alpha and assigning Capt. Wright directly emits ONE
      // `mission-assigned` event that matches both `move-mission` (any
      // first action on the mission) and `assign-busy` (toResource is the
      // conflict pilot). Without cascade, the user would land on
      // `assign-busy` with their action already done and the banner
      // telling them to do it again.
      let next = state;
      // Bound the loop by step count so a self-matching step (which
      // shouldn't exist) can't infinite-loop.
      for (let i = 0; i < deps.steps.length; i++) {
        if (next.currentStep === 'done') break;
        const step = findStep(deps.steps, next.currentStep);
        if (!step) break;
        if (!step.matches(action.event, deps.ctx)) break;
        next = {
          ...next,
          bootstrapping: false,
          currentStep: nextStepId(deps.steps, next.currentStep),
          history: [...next.history, next.currentStep],
        };
      }
      return next;
    }

    case 'advance': {
      if (state.currentStep === 'done') return state;
      return {
        ...state,
        bootstrapping: false,
        currentStep: nextStepId(deps.steps, state.currentStep),
        history: [...state.history, state.currentStep],
      };
    }

    case 'restart':
      return { ...INITIAL_STATE };

    case 'exit':
      return { ...state, mode: 'free-play' };
  }
}
