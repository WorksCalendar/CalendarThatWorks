/**
 * CalendarEngine — overlap validation rule.
 *
 * Checks whether a proposed event time conflicts with an existing event
 * that shares the same resource.
 *
 * Policy:
 *   - Unscoped events (no resourceId) → never flagged (may freely overlap)
 *   - Resource-scoped events → soft violation when another event for the same
 *     resource overlaps, unless the conflicting policy is 'block' (hard).
 */

import type { EngineEvent } from '../schema/eventSchema.js';
import type { Violation, OperationContext, ChangeShape } from './validationTypes.js';

export function validateOverlap(
  change: ChangeShape,
  ctx: OperationContext,
): Violation | null {
  const resourceId = change.resourceId ?? change.event?.resourceId ?? null;
  if (!resourceId) return null; // unscoped — skip

  const events = ctx.events ?? [];
  const conflictPolicy = ctx.config?.conflictPolicy ?? 'warn';
  if (conflictPolicy === 'allow') return null;

  const selfId = change.event?.id ?? null;

  const conflict = events.find(ev => {
    if (selfId && ev.id === selfId)       return false; // skip self
    if (ev.resourceId !== resourceId)     return false;
    if (ev.allDay)                        return false; // all-day events don't block time slots
    // Overlap: [A.start, A.end) ∩ [B.start, B.end) is non-empty
    return change.newStart < ev.end && change.newEnd > ev.start;
  });

  if (!conflict) return null;

  return {
    rule:               'overlap',
    severity:           conflictPolicy === 'block' ? 'hard' : 'soft',
    message:            `${resourceId} has a conflict with "${conflict.title}".`,
    conflictingEventId: conflict.id,
  };
}
