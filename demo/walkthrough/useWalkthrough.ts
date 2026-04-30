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

import { useCallback, useMemo, useReducer, useRef } from 'react';
import { INITIAL_STATE, reducer } from './reducer';
import { STEPS } from './steps';
import type {
  Step,
  StepContext,
  WalkthroughEvent,
  WalkthroughState,
} from './types';

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
    INITIAL_STATE,
  );

  // Snapshot of the previous state of Alpha so we can tell a "move" (time
  // change, same resource) from a "reassign" (resource change). Refs because
  // adapters fire outside React's render cycle. Seeded from ctx so the very
  // first drag is observable — otherwise Step 1 never advances.
  const lastAlphaSnapshot = useRef<{ resource: string | null; startIso: string }>({
    resource: ctx.alphaInitialResource,
    startIso: ctx.alphaInitialStartIso,
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
      if (ev.id !== ctx.alphaEventId) return;
      const prevStartIso = lastAlphaSnapshot.current.startIso;
      observe({
        kind: 'event-moved',
        eventId: ev.id,
        previousResource: lastAlphaSnapshot.current.resource,
        previousStartIso: prevStartIso,
      });
      lastAlphaSnapshot.current = {
        resource: lastAlphaSnapshot.current.resource,
        startIso: toIso(newStart),
      };
    },

    onEventSave: (ev) => {
      delegate.onEventSave?.(ev);
      if (ev.id !== ctx.alphaEventId) return;
      const snapshot     = lastAlphaSnapshot.current;
      const nextResource = ev.resource ?? null;
      const nextStartIso = toIso(ev.start ?? snapshot.startIso);

      // The demo wires drag-drop through onEventSave for both time and
      // resource changes (no separate onEventMove / onEventGroupChange).
      // Distinguish them here so steps 1 and 2/3 see different events.
      if (snapshot.resource !== nextResource) {
        observe({
          kind: 'event-reassigned',
          eventId: ev.id ?? '',
          toResource: nextResource,
        });
      } else if (snapshot.startIso !== nextStartIso) {
        observe({
          kind: 'event-moved',
          eventId: ev.id ?? '',
          previousResource: snapshot.resource,
          previousStartIso: snapshot.startIso,
        });
      }

      lastAlphaSnapshot.current = { resource: nextResource, startIso: nextStartIso };
    },

    onConflictCheck: async (ev, candidate) => {
      const result = await delegate.onConflictCheck?.(ev, candidate);
      if (ev.id === ctx.alphaEventId && result) {
        // The host returned a conflict object — the calendar uses it to
        // flag overlap. We don't care about the shape, only that one was
        // detected against the Bravo decoy.
        observe({
          kind: 'conflict-detected',
          eventId: ev.id,
          conflictingEventId: ctx.bravoEventId,
        });
      }
      return result;
    },

    onViewChange: (view) => {
      delegate.onViewChange?.(view);
      observe({ kind: 'view-changed', view });
    },
  }), [delegate, ctx.alphaEventId, ctx.bravoEventId, observe]);

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
