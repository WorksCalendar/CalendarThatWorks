/**
 * CalendarEngine — validateOperation: the central validation pipeline.
 *
 * Runs all rules in order.  Hard violations block commit.
 * Soft violations produce a warning that the user can override.
 *
 * This wraps and supersedes the legacy validateChange() in core/validator.js.
 * The engine uses this; the legacy function stays in place for backward compat.
 */

import type { EngineOperation } from '../schema/operationSchema.js';
import type { EngineEvent } from '../schema/eventSchema.js';
import type {
  Violation,
  ValidationResult,
  OperationContext,
  ChangeShape,
} from './validationTypes.js';
import { VALID_RESULT } from './validationTypes.js';
import { validateDuration, validateBlockedWindow } from './validateConstraints.js';
import { validateOverlap }       from './validateOverlap.js';
import { validateWorkingHours }  from './validateWorkingHours.js';

// ─── Rule registry ────────────────────────────────────────────────────────────

const RULES: Array<(change: ChangeShape, ctx: OperationContext) => Violation | null> = [
  validateDuration,       // hard — always first
  validateBlockedWindow,  // hard
  validateOverlap,        // soft (or hard when conflictPolicy='block')
  validateWorkingHours,   // soft
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate an EngineOperation against the current context.
 *
 * Only validates operations that change event times (create, move, resize).
 * Update and delete operations skip time-based rules (the caller may run
 * custom rules for those if needed).
 */
export function validateOperation(
  op: EngineOperation,
  ctx: OperationContext,
  events: readonly EngineEvent[],
): ValidationResult {
  // Only time-changing operations need time-based validation
  if (op.type !== 'create' && op.type !== 'move' && op.type !== 'resize') {
    return VALID_RESULT;
  }

  // Build the change shape
  const newStart: Date = op.type === 'create' ? op.event.start : op.newStart;
  const newEnd:   Date = op.type === 'create' ? op.event.end   : op.newEnd;

  const existingEvent =
    op.type === 'move' || op.type === 'resize'
      ? events.find(e => e.id === op.id) ?? null
      : null;

  const change: ChangeShape = {
    newStart,
    newEnd,
    event:      existingEvent,
    resourceId: existingEvent?.resourceId
                ?? (op.type === 'create' ? (op.event.resourceId ?? null) : null),
  };

  // Run all rules with the full event list in context
  const ctxWithEvents: OperationContext = { ...ctx, events };
  const violations = RULES.map(r => r(change, ctxWithEvents)).filter(Boolean) as Violation[];

  if (!violations.length) return VALID_RESULT;

  const hasHard = violations.some(v => v.severity === 'hard');
  const hasSoft = violations.some(v => v.severity === 'soft');

  return {
    allowed:        !hasHard,
    severity:       hasHard ? 'hard' : hasSoft ? 'soft' : 'none',
    violations,
    suggestedPatch: null,
  };
}

/**
 * Convenience: run validation and return true if the operation is allowed.
 * Useful for filtering operations programmatically.
 */
export function isOperationAllowed(
  op: EngineOperation,
  ctx: OperationContext,
  events: readonly EngineEvent[],
): boolean {
  return validateOperation(op, ctx, events).allowed;
}
