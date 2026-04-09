/**
 * CalendarEngine — the central operation pipeline.
 *
 * Flow for every mutation:
 *   1. Validate (run all rules from validation/)
 *   2. If hard violation → reject (return OperationResult with status='rejected')
 *   3. If soft violation → return pending-confirmation (caller decides to confirm)
 *   4. If clean (or confirmed override) → apply the state change, return accepted
 *
 * The apply step is pure: given a Map<id, EngineEvent> and an op, it returns
 * the minimal set of EventChanges required to transition to the new state.
 *
 * Callers: CalendarEngine.dispatch() wraps this with state management.
 */

import { addHours } from 'date-fns';
import type { EngineEvent } from '../schema/eventSchema.js';
import { makeEvent } from '../schema/eventSchema.js';
import type { EngineOperation } from '../schema/operationSchema.js';
import type { OperationContext } from '../validation/validationTypes.js';
import type {
  OperationResult,
  EventChange,
} from './operationResult.js';
import {
  makeRejectedResult,
  makePendingResult,
} from './operationResult.js';
import { validateOperation } from '../validation/validateOperation.js';
import { resolveOperationScope } from './resolveOperationScope.js';
import { nextEngineId } from '../adapters/normalizeInputEvent.js';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ApplyOptions {
  /**
   * When true, soft violations are treated as accepted-with-warnings rather
   * than pending-confirmation.  Use when the user has already confirmed.
   */
  overrideSoftViolations?: boolean;
}

/**
 * Validate and (if allowed) apply an operation to the events map.
 *
 * @param op       The operation to apply
 * @param events   Current event map (id → EngineEvent)
 * @param ctx      Validation context (businessHours, blockedWindows, config)
 * @param opts     Behavioral overrides
 */
export function applyOperation(
  op: EngineOperation,
  events: ReadonlyMap<string, EngineEvent>,
  ctx: OperationContext = {},
  opts: ApplyOptions = {},
): OperationResult {
  const eventList = Array.from(events.values());

  // 1. Validate
  const validation = validateOperation(op, ctx, eventList);

  // 2. Hard violation → reject
  if (!validation.allowed) {
    return makeRejectedResult(op, validation);
  }

  // 3. Soft violation + not confirmed → pending
  if (validation.severity === 'soft' && !opts.overrideSoftViolations) {
    return makePendingResult(op, validation);
  }

  // 4. Apply
  const changes = computeChanges(op, events, eventList);
  const status  = validation.severity === 'soft' ? 'accepted-with-warnings' : 'accepted';

  return { status, operation: op, validation, changes };
}

// ─── Change computation ───────────────────────────────────────────────────────

function computeChanges(
  op: EngineOperation,
  events: ReadonlyMap<string, EngineEvent>,
  eventList: EngineEvent[],
): EventChange[] {
  switch (op.type) {
    case 'create':  return applyCreate(op, events);
    case 'update':  return applyUpdate(op, events, eventList);
    case 'delete':  return applyDelete(op, events, eventList);
    case 'move':    return applyMove(op, events, eventList);
    case 'resize':  return applyResize(op, events, eventList);
    default: {
      const _x: never = op;
      return [];
    }
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

function applyCreate(
  op: Extract<EngineOperation, { type: 'create' }>,
  _events: ReadonlyMap<string, EngineEvent>,
): EventChange[] {
  const id = nextEngineId();
  const raw = op.event;
  const hasRrule = typeof raw.rrule === 'string' && raw.rrule.length > 0;

  const event = makeEvent(id, {
    title:        raw.title,
    start:        raw.start,
    end:          raw.end,
    timezone:     raw.timezone     ?? null,
    allDay:       raw.allDay       ?? false,
    category:     raw.category     ?? null,
    resourceId:   raw.resourceId   ?? null,
    status:       raw.status       ?? 'confirmed',
    color:        raw.color        ?? null,
    rrule:        raw.rrule        ?? null,
    exdates:      raw.exdates      ?? [],
    meta:         raw.meta         ?? {},
    seriesId:     hasRrule ? id : null,
    occurrenceId: null,
    detachedFrom: null,
  });

  return [{ type: 'created', event }];
}

// ─── Update ───────────────────────────────────────────────────────────────────

function applyUpdate(
  op: Extract<EngineOperation, { type: 'update' }>,
  events: ReadonlyMap<string, EngineEvent>,
  eventList: EngineEvent[],
): EventChange[] {
  const existing = events.get(op.id);
  if (!existing) return [];

  // Handle recurring scope
  if (op.scope && op.scope !== 'series' && op.occurrenceDate) {
    const resolved = resolveOperationScope(op, existing, eventList);
    if (resolved.needsRecurringResolution) return resolved.changes ?? [];
  }

  const after: EngineEvent = { ...existing, ...op.patch, id: op.id };
  return [{ type: 'updated', id: op.id, before: existing, after }];
}

// ─── Delete ───────────────────────────────────────────────────────────────────

function applyDelete(
  op: Extract<EngineOperation, { type: 'delete' }>,
  events: ReadonlyMap<string, EngineEvent>,
  eventList: EngineEvent[],
): EventChange[] {
  const existing = events.get(op.id);
  if (!existing) return [];

  // Handle recurring scope
  if (op.scope && op.scope !== 'series' && op.occurrenceDate) {
    const resolved = resolveOperationScope(op as any, existing, eventList);
    if (resolved.needsRecurringResolution) return resolved.changes ?? [];
  }

  return [{ type: 'deleted', id: op.id, event: existing }];
}

// ─── Move ─────────────────────────────────────────────────────────────────────

function applyMove(
  op: Extract<EngineOperation, { type: 'move' }>,
  events: ReadonlyMap<string, EngineEvent>,
  eventList: EngineEvent[],
): EventChange[] {
  const existing = events.get(op.id);
  if (!existing) return [];

  // Handle recurring scope
  if (op.scope && op.scope !== 'series' && op.occurrenceDate) {
    const resolved = resolveOperationScope(op, existing, eventList);
    if (resolved.needsRecurringResolution) return resolved.changes ?? [];
  }

  const after: EngineEvent = { ...existing, start: op.newStart, end: op.newEnd };
  return [{ type: 'updated', id: op.id, before: existing, after }];
}

// ─── Resize ───────────────────────────────────────────────────────────────────

function applyResize(
  op: Extract<EngineOperation, { type: 'resize' }>,
  events: ReadonlyMap<string, EngineEvent>,
  eventList: EngineEvent[],
): EventChange[] {
  // Resize shares the same state transition as move
  const moveOp: Extract<EngineOperation, { type: 'move' }> = { ...op, type: 'move' };
  return applyMove(moveOp, events, eventList);
}
