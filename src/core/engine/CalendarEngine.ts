/**
 * CalendarEngine — framework-agnostic state container.
 *
 * Primary API:
 *   const engine = new CalendarEngine({ events: [...], view: 'month' });
 *   const unsub  = engine.subscribe(state => render(state));
 *
 *   // Navigation / filter dispatches (pure state, no validation)
 *   engine.dispatch({ type: 'NAVIGATE_NEXT' });
 *
 *   // Mutation with validation (returns OperationResult)
 *   const result = engine.applyMutation(
 *     buildOperation.fromDragMove(event, newStart, newEnd),
 *     ctx,
 *   );
 *   if (result.status === 'pending-confirmation') showWarningDialog(result);
 *
 *   // Occurrence expansion (main read path for views)
 *   const occurrences = engine.getOccurrencesInRange(rangeStart, rangeEnd);
 *
 *   unsub();
 */

import { applyOperation as applyStateOp } from './operations.js';
import {
  applyOperation as applyMutationOp,
  type ApplyOptions,
} from './operations/applyOperation.js';
import {
  getOccurrencesInRange,
  type GetOccurrencesOptions,
} from './selectors/getOccurrencesInRange.js';
import {
  beginTransaction,
} from './transactions/beginTransaction.js';
import {
  commitTransaction,
} from './transactions/commitTransaction.js';
import {
  rollbackTransaction,
} from './transactions/rollbackTransaction.js';
import type { TransactionHandle } from './transactions/beginTransaction.js';
import type { OperationResult } from './operations/operationResult.js';
import type { EngineOperation } from './schema/operationSchema.js';
import type { EngineOccurrence } from './schema/occurrenceSchema.js';
import type { OperationContext } from './validation/validationTypes.js';
import type {
  CalendarState,
  CalendarEngineInit,
  FilterState,
  Operation,
  StateListener,
  Unsubscribe,
} from './types.js';
import type { EngineEvent } from './schema/eventSchema.js';

// ─── Initial state ────────────────────────────────────────────────────────────

export function createInitialState(init: CalendarEngineInit = {}): CalendarState {
  const eventMap = new Map<string, EngineEvent>();
  for (const ev of init.events ?? []) {
    eventMap.set(ev.id, ev);
  }

  const defaultFilter: FilterState = {
    search: '',
    categories: new Set(),
    resources: new Set(),
  };

  const filter: FilterState = init.filter
    ? {
        search: init.filter.search ?? '',
        categories: init.filter.categories ?? new Set(),
        resources: init.filter.resources ?? new Set(),
      }
    : defaultFilter;

  return {
    events: eventMap,
    view: init.view ?? 'month',
    cursor: init.cursor ?? new Date(),
    filter,
    config: init.config ?? {},
    selection: new Set(),
  };
}

// ─── Engine class ─────────────────────────────────────────────────────────────

export class CalendarEngine {
  private _state: CalendarState;
  private _listeners: Set<StateListener> = new Set();

  constructor(init: CalendarEngineInit = {}) {
    this._state = createInitialState(init);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  get state(): CalendarState {
    return this._state;
  }

  // ── Navigation / filter dispatch (no validation) ────────────────────────────

  /**
   * Dispatch a navigation or filter operation.
   * These are pure state transitions with no validation or side effects.
   * For event mutations (create/move/resize/update/delete), use applyMutation().
   */
  dispatch(op: Operation): CalendarState {
    const next = applyStateOp(this._state, op);
    if (next !== this._state) {
      this._state = next;
      this._notify();
    }
    return this._state;
  }

  // ── Mutation pipeline (with validation) ──────────────────────────────────────

  /**
   * Apply an EngineOperation (create/move/resize/update/delete) through the
   * full validate → apply pipeline.
   *
   * Returns an OperationResult:
   *   - 'accepted'               → changes applied, state notified
   *   - 'accepted-with-warnings' → applied despite soft violations
   *   - 'pending-confirmation'   → soft violation, state NOT changed; call again
   *                                with opts.overrideSoftViolations=true to confirm
   *   - 'rejected'               → hard violation, state NOT changed
   */
  applyMutation(
    op: EngineOperation,
    ctx: OperationContext = {},
    opts: ApplyOptions = {},
  ): OperationResult {
    const result = applyMutationOp(op, this._state.events, ctx, opts);

    if (result.status === 'accepted' || result.status === 'accepted-with-warnings') {
      // Commit changes to state
      const tx = beginTransaction(this._state.events);
      const commit = commitTransaction(tx, this._state.events, result.changes);
      this._state = { ...this._state, events: commit.events };
      this._notify();
    }

    return result;
  }

  // ── Read path ─────────────────────────────────────────────────────────────────

  /**
   * Return all occurrences overlapping [rangeStart, rangeEnd), with
   * recurrence fully expanded.  This is the canonical read path for views.
   */
  getOccurrencesInRange(
    rangeStart: Date,
    rangeEnd: Date,
    opts: GetOccurrencesOptions = {},
  ): EngineOccurrence[] {
    const filterOpts: GetOccurrencesOptions = {
      filter: opts.filter ?? this._state.filter,
      ...opts,
    };
    return getOccurrencesInRange(this._state.events, rangeStart, rangeEnd, filterOpts);
  }

  // ── Subscribe ─────────────────────────────────────────────────────────────────

  /**
   * Subscribe to state changes.  The listener fires synchronously after
   * every dispatch or applyMutation that produces a state change.
   *
   * Returns an unsubscribe function.
   */
  subscribe(listener: StateListener): Unsubscribe {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  // ── Convenience helpers ───────────────────────────────────────────────────────

  /**
   * Replace all events atomically (e.g. on remote data refresh).
   * Notifies subscribers once.
   */
  setEvents(events: ReadonlyArray<EngineEvent>): void {
    const map = new Map<string, EngineEvent>(events.map(ev => [ev.id, ev]));
    this._state = { ...this._state, events: map };
    this._notify();
  }

  /** Reset to a fresh initial state, optionally preserving config. */
  reset(init: CalendarEngineInit = {}): void {
    this._state = createInitialState({
      config: this._state.config,
      ...init,
    });
    this._notify();
  }

  // ── Transaction helpers ───────────────────────────────────────────────────────

  /**
   * Snapshot the current events map for optimistic UI or undo/redo.
   * Use rollbackTo(handle) to restore this snapshot.
   */
  snapshot(label?: string): TransactionHandle {
    return beginTransaction(this._state.events, label);
  }

  /** Restore state to a previous snapshot. Notifies subscribers. */
  rollbackTo(handle: TransactionHandle): void {
    const restored = rollbackTransaction(handle);
    this._state = { ...this._state, events: restored };
    this._notify();
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  private _notify(): void {
    for (const listener of this._listeners) {
      try {
        listener(this._state);
      } catch (err) {
        console.error('[CalendarEngine] Listener threw:', err);
      }
    }
  }
}
