/**
 * demo/walkthrough/useWalkthrough.ts — React surface for the walkthrough.
 *
 * Wraps the pure reducer in a hook and exposes:
 *   • `state`         — current step, mode, history, etc.
 *   • `step`          — the active Step record (banner + spotlight + hint)
 *   • `wrap`          — adapters that decorate the demo's existing host
 *                       callbacks. They never replace behavior; they just
 *                       inspect each call and emit observe() events.
 *   • controls        — `advance`, `restart`, `exit`
 *
 * No localStorage persistence yet — the walkthrough is session-scoped.
 * Returning visitors who saw it once can opt back in via a "Restart tour"
 * button that we'll wire when we mount the UI.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { INITIAL_STATE, reducer } from './reducer';
import { STEPS } from './steps';
import type {
  Step,
  StepContext,
  WalkthroughEvent,
  WalkthroughMode,
  WalkthroughState,
} from './types';

/** localStorage key for the dismissed-tour flag. Only the mode is persisted —
 *  the active step always resets so a returning visitor who restarts the tour
 *  starts from step 1 with a clean event log. */
const STORAGE_KEY = 'wc-walkthrough-mode';

function readPersistedMode(): WalkthroughMode {
  if (typeof window === 'undefined') return 'guided';
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'free-play'
      ? 'free-play'
      : 'guided';
  } catch {
    return 'guided';
  }
}

function persistMode(mode: WalkthroughMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // quota / private mode — silent failure, just won't persist
  }
}

interface UseWalkthroughArgs {
  ctx: StepContext;
  /** Pre-existing host callbacks. Each `wrap*` returns a decorated version
   *  that calls the original and then emits the right WalkthroughEvent. */
  delegate: HostDelegate;
}

export interface HostDelegate {
  onEventMove?: (event: HostEvent, newStart: Date, newEnd: Date) => void;
  onEventSave?: (event: HostEvent) => void;
  onConflictCheck?: (event: HostEvent, candidate: HostEvent) => Promise<unknown> | unknown;
  onViewChange?: (view: string) => void;
  onMapWidgetOpenChange?: (open: boolean) => void;
}

/** Minimal event shape the adapter cares about — kept loose so the demo's
 *  @ts-nocheck event objects flow through without friction. */
interface HostEvent {
  id?: string;
  resource?: string | null;
  start?: string | Date;
  end?: string | Date;
}

export interface WalkthroughHandle {
  state: WalkthroughState;
  step: Step;
  steps: readonly Step[];
  wrapped: HostDelegate;
  observe: (event: WalkthroughEvent) => void;
  advance: () => void;
  restart: () => void;
  exit: () => void;
}

export function useWalkthrough({ ctx, delegate }: UseWalkthroughArgs): WalkthroughHandle {
  const [state, dispatch] = useReducer(
    (s: WalkthroughState, a: Parameters<typeof reducer>[1]) =>
      reducer(s, a, { steps: STEPS, ctx }),
    undefined,
    () => ({ ...INITIAL_STATE, mode: readPersistedMode() }),
  );

  // Persist mode changes so a dismissed tour stays dismissed across reloads.
  // Only the mode is saved — currentStep / history reset on each load so
  // restarting starts cleanly at step 1.
  useEffect(() => {
    persistMode(state.mode);
  }, [state.mode]);

  // Snapshot of the mission's previous state so we can tell "moved" (time
  // changed, resource unchanged) from "assigned" (resource changed). Refs
  // because adapters fire outside React's render cycle. The mission seed
  // starts unassigned, so resource begins as null.
  const lastMissionSnapshot = useRef<{ resource: string | null; startIso: string }>({
    resource: null,
    startIso: ctx.missionInitialStartIso,
  });

  const observe = useCallback((event: WalkthroughEvent) => {
    dispatch({ type: 'observe', event });
  }, []);

  const advance = useCallback(() => dispatch({ type: 'advance' }), []);
  const restart = useCallback(() => dispatch({ type: 'restart' }), []);
  const exit    = useCallback(() => dispatch({ type: 'exit' }), []);

  const wrapped = useMemo<HostDelegate>(() => ({
    onEventMove: (ev, newStart, newEnd) => {
      delegate.onEventMove?.(ev, newStart, newEnd);
      if (ev.id !== ctx.missionEventId) return;
      const prevStartIso = lastMissionSnapshot.current.startIso;
      observe({
        kind: 'mission-moved',
        eventId: ev.id,
        previousStartIso: prevStartIso,
      });
      lastMissionSnapshot.current = {
        resource: lastMissionSnapshot.current.resource,
        startIso: toIso(newStart),
      };
    },

    onEventSave: (ev) => {
      delegate.onEventSave?.(ev);
      if (ev.id !== ctx.missionEventId) return;
      const snapshot     = lastMissionSnapshot.current;
      const nextResource = ev.resource ?? null;
      const nextStartIso = toIso(ev.start ?? snapshot.startIso);

      // The demo wires drag-drop and form-saves through onEventSave for
      // both time and resource changes. Distinguish:
      //   • resource changed (null → pilot, or pilot A → pilot B) → assigned
      //   • only time changed                                      → moved
      if (snapshot.resource !== nextResource) {
        observe({
          kind: 'mission-assigned',
          eventId: ev.id ?? '',
          previousResource: snapshot.resource,
          toResource: nextResource,
        });
      } else if (snapshot.startIso !== nextStartIso) {
        observe({
          kind: 'mission-moved',
          eventId: ev.id ?? '',
          previousStartIso: snapshot.startIso,
        });
      }

      lastMissionSnapshot.current = { resource: nextResource, startIso: nextStartIso };
    },

    onConflictCheck: async (ev, candidate) => {
      // The walkthrough doesn't use this for advancement (the assign step
      // is satisfied by mission-assigned events). Kept for future use and
      // so wrapping it stays a no-op pass-through if a host wires it.
      return delegate.onConflictCheck?.(ev, candidate);
    },

    onViewChange: (view) => {
      delegate.onViewChange?.(view);
      observe({ kind: 'view-changed', view });
    },

    onMapWidgetOpenChange: (open) => {
      delegate.onMapWidgetOpenChange?.(open);
      // Only the open transition advances the walkthrough; closing the modal
      // shouldn't fire a redundant observation.
      if (open) observe({ kind: 'map-widget-opened' });
    },
  }), [delegate, ctx.missionEventId, observe]);

  const step = useMemo<Step>(() => {
    const found = STEPS.find(s => s.id === state.currentStep);
    // STEPS always contains a 'done' record, so this is unreachable. The
    // fallback exists only to satisfy the type checker.
    return found ?? STEPS[STEPS.length - 1]!;
  }, [state.currentStep]);

  return {
    state,
    step,
    steps: STEPS,
    wrapped,
    observe,
    advance,
    restart,
    exit,
  };
}

function toIso(d: string | Date): string {
  return d instanceof Date ? d.toISOString() : d;
}
