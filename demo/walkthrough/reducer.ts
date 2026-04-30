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
  currentStep: 'move-job',
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
      if (state.currentStep === 'done') return state;
      const step = findStep(deps.steps, state.currentStep);
      if (!step) return state;
      if (!step.matches(action.event, deps.ctx)) return state;
      return {
        ...state,
        bootstrapping: false,
        currentStep: nextStepId(deps.steps, state.currentStep),
        history: [...state.history, state.currentStep],
      };
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
