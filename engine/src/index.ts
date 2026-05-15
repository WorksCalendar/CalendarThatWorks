/**
 * works-calendar-engine — public API
 *
 * Framework-agnostic scheduling state machine with rule-based conflict
 * detection. Pure TypeScript; only runtime dep is date-fns.
 */

// State machine
export { CalendarEngine, createInitialState } from './engine/CalendarEngine';
export { EventBus, channelForApprovalTransition } from './engine/eventBus';
export { UndoRedoManager } from './engine/UndoRedoManager';

// Operations
import * as buildOperation from './engine/operations/buildOperation';
export { buildOperation };
export type { OperationResult } from './engine/operations/operationResult';
export type { EngineOperation } from './engine/schema/operationSchema';

// Schema types
export type { EngineEvent } from './engine/schema/eventSchema';
export type { EngineOccurrence } from './engine/schema/occurrenceSchema';
export type { EngineResource } from './engine/schema/resourceSchema';
export type { Assignment } from './engine/schema/assignmentSchema';
export type { Dependency } from './engine/schema/dependencySchema';
export type { EventConstraint } from './engine/schema/constraintSchema';
export type { ResourcePool, PoolStrategy } from './engine/schema/resourcePoolSchema';

// Engine domain types
export type {
  CalendarView,
  CalendarState,
  FilterState,
} from './engine/types';

// Conflict detection
export {
  evaluateConflicts,
  CONFLICT_RULE_TYPES,
} from './conflictEngine';
export type {
  ConflictEvent,
  ConflictRule,
  ResourceOverlapRule,
  CategoryMutexRule,
  MinRestRule,
  CapacityOverflowRule,
  OutsideBusinessHoursRule,
  AvailabilityViolationRule,
  HoldConflictRule,
  PolicyViolationRule,
} from './conflictEngine';

// Availability / requirements / holds / pools
export { evaluateAvailability } from './availability/evaluateAvailability';
export type {
  AvailabilityWindow,
  AvailabilityResult,
  AvailabilityFailure,
  AvailabilitySuccess,
  AvailabilityReasonCode,
} from './availability/evaluateAvailability';

export { evaluateRequirements } from './requirements/evaluateRequirements';
export type {
  RequirementShortfall,
  RequirementsEvaluation,
} from './requirements/evaluateRequirements';

export { createHoldRegistry, findBlockingHold } from './holds/holdRegistry';
export type { Hold, HoldWindow } from './holds/holdRegistry';

export { resolvePool } from './pools/resolvePool';
export type {
  ResolvePoolResult,
  ResolvePoolSuccess,
  ResolvePoolError,
  ResolvePoolErrorCode,
} from './pools/resolvePool';

// Schedule kinds + overlap math
export {
  SCHEDULE_KINDS,
  normalizeScheduleKind,
  isOpenShiftEvent,
  isCoveringEvent,
  isShiftOrOnCallEvent,
  isCoveredShift,
  isScheduleWorkflowEvent,
  SCHEDULE_WORKFLOW_CATEGORIES,
} from './scheduleModel';

export {
  intervalsOverlap,
  detectShiftConflicts,
  buildOpenShiftEvent,
} from './scheduleOverlap';

// Recurrence
export { expandOccurrences } from './engine/recurrence/expandOccurrences';
export { expandRRule } from './engine/recurrence/expandRRule';

// Approval state machine (lightweight — no workflow DSL)
export {
  transitionApproval,
  legalActionsFrom,
  LEGAL_TRANSITIONS,
} from './approvals/transitions';
export {
  appendAuditEntry,
  verifyAuditChain,
  isAuditChainValid,
} from './approvals/auditChain';
export { lifecycleFromApprovalStage } from './approvals/lifecycleFromApprovalStage';

// Boundary helpers
export { normalizeEvent, normalizeEvents } from './eventModel';
export { createId } from './createId';

// Host-facing types (consumers need these to talk to the engine)
export type {
  EventStatus,
  EventLifecycleState,
  EventComment,
  ReminderDef,
  WorksCalendarEvent,
  NormalizedEvent,
  EventVisualPriority,
} from './types/events';
export { isLifecycleState, EVENT_LIFECYCLE_STATES, isVisualPriority } from './types/events';
export type {
  ApprovalStage,
  ApprovalStageId,
  ApprovalActionId,
  ApprovalHistoryActionId,
  ApprovalHistoryEntry,
  CategoryDef,
  BookingPolicy,
} from './types/assets';
