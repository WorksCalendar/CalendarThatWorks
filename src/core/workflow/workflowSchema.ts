/**
 * Workflow DSL — JSON schema (issue #219, Phase 1).
 *
 * A `Workflow` is a declarative, versioned graph of nodes and edges
 * that drives an approval flow end-to-end. Hosts persist a running
 * instance on `event.meta.workflowInstance`; the engine calls
 * `advance()` whenever an actor takes an action.
 *
 * Phase 1 node types:
 *   - `condition` — branches on an expression (true/false edges).
 *   - `approval`  — waits for approve/deny from an assignee.
 *   - `notify`    — fires a `WorkflowEmitEvent` and falls through.
 *   - `terminal`  — ends the flow with a final outcome.
 *
 * Phase 4 adds:
 *   - `parallel`  — fans out into multiple branches simultaneously.
 *   - `join`      — collects branch outcomes with a quorum policy.
 */

// ─── Trigger ──────────────────────────────────────────────────────────────

export type WorkflowTrigger = 'on_submit' | 'on_edit' | 'on_cancel'

// ─── Nodes ────────────────────────────────────────────────────────────────

export interface WorkflowConditionNode {
  readonly id: string
  readonly type: 'condition'
  /** Expression evaluated against the action's variables. See `expression.ts`. */
  readonly expr: string
  readonly label?: string | undefined
}

export type TimeoutBehavior = 'escalate' | 'auto-approve' | 'auto-deny'

export interface WorkflowApprovalNode {
  readonly id: string
  readonly type: 'approval'
  /** Routing hint — e.g. "role:director", "user:alice". Host interprets. */
  readonly assignTo: string
  readonly label?: string | undefined
  /** Phase-3 fields; schema-only in Phase 1. */
  readonly slaMinutes?: number | undefined
  readonly onTimeout?: TimeoutBehavior | undefined
}

export interface WorkflowNotifyNode {
  readonly id: string
  readonly type: 'notify'
  readonly channel: string
  readonly template?: string | undefined
  readonly label?: string | undefined
}

export type WorkflowOutcome = 'finalized' | 'denied' | 'cancelled'

export interface WorkflowTerminalNode {
  readonly id: string
  readonly type: 'terminal'
  readonly outcome: WorkflowOutcome
  readonly label?: string | undefined
}

// ─── Parallel / join (Phase 4, issue #223) ────────────────────────────────

/**
 * Parallel fan-out modes. Determine when the paired join releases.
 *
 *  - `requireAll` — every branch must approve; a single deny fails.
 *  - `requireAny` — first approval short-circuits; remaining branches are abandoned.
 *  - `requireN`   — at least `n` approvals release; if the remaining branches can't reach `n`, fail early.
 */
export type ParallelMode = 'requireAll' | 'requireAny' | 'requireN'

export interface WorkflowParallelNode {
  readonly id: string
  readonly type: 'parallel'
  /** Entry node id for each branch — each must path to the paired join. */
  readonly branches: readonly string[]
  readonly mode: ParallelMode
  /** Required approvals when `mode === 'requireN'`. Must satisfy `1 ≤ n ≤ branches.length`. */
  readonly n?: number | undefined
  readonly label?: string | undefined
}

export interface WorkflowJoinNode {
  readonly id: string
  readonly type: 'join'
  /** Id of the paired `parallel` node. Runtime enforces one-to-one pairing. */
  readonly pairedWith: string
  readonly label?: string | undefined
}

export type WorkflowNode =
  | WorkflowConditionNode
  | WorkflowApprovalNode
  | WorkflowNotifyNode
  | WorkflowTerminalNode
  | WorkflowParallelNode
  | WorkflowJoinNode

// ─── Edges ────────────────────────────────────────────────────────────────

/**
 * Edge guard. The interpreter walks an edge when its `when` matches
 * the signal emitted by the previous node:
 *
 *   - `condition`  → 'true' | 'false'
 *   - `approval`   → 'approved' | 'denied' | 'timeout' (when slaMinutes set)
 *   - `notify`     → 'default'
 *   - `parallel`   → (branches are addressed via `branches: string[]`, not edges)
 *   - `join`       → 'default'
 *   - `terminal`   → (no outgoing edges)
 *
 * Branch-to-join edges use `when: 'branch-completed'` so the validator
 * can distinguish them from ordinary approvals (whose outcomes are
 * rolled up into the parallel frame).
 *
 * An edge with no `when` is a default transition, taken when no guarded
 * edge matches. At most one default edge per source node.
 */
export type EdgeGuard =
  | 'true'
  | 'false'
  | 'approved'
  | 'denied'
  | 'timeout'
  | 'branch-completed'
  | 'default'

export interface WorkflowEdge {
  readonly from: string
  readonly to: string
  readonly when?: EdgeGuard
}

// ─── Workflow ─────────────────────────────────────────────────────────────

export interface Workflow {
  readonly id: string
  readonly version: number
  readonly trigger: WorkflowTrigger
  /** Entry node id — the first node entered when a fresh instance starts. */
  readonly startNodeId: string
  readonly nodes: readonly WorkflowNode[]
  readonly edges: readonly WorkflowEdge[]
}

// ─── Instance ─────────────────────────────────────────────────────────────

export type WorkflowInstanceStatus = 'running' | 'awaiting' | 'completed' | 'failed'

export interface WorkflowHistoryEntry {
  readonly nodeId: string
  /** ISO timestamp this node was entered. */
  readonly enteredAt: string
  /** ISO timestamp this node was exited; absent while current. */
  readonly exitedAt?: string
  /** Signal emitted when exiting — drives edge selection. */
  readonly signal?: EdgeGuard
  readonly actor?: string
  readonly reason?: string
}

/**
 * Per-branch state inside a parallel frame. Each entry describes where
 * one branch is sitting right now: `activeNodeId` is the approval it's
 * currently awaiting (or null while auto-advancing / after completion).
 */
export interface ParallelBranchState {
  readonly branchEntryId: string
  readonly activeNodeId: string | null
  /** Set once the branch has reached the paired join. */
  readonly completedAt?: string
  /** Signal the branch emitted when exiting into the join ('approved' / 'denied' / 'default'). */
  readonly completedSignal?: EdgeGuard
}

/**
 * Runtime state for one `parallel` node currently in flight. Hosts see
 * one frame per nested parallel scope; the outermost frame is `[0]`.
 */
export interface WorkflowParallelFrame {
  readonly parallelId: string
  readonly joinId: string
  readonly mode: ParallelMode
  readonly n?: number | undefined
  readonly branches: readonly ParallelBranchState[]
}

export interface WorkflowInstance {
  readonly workflowId: string
  readonly workflowVersion: number
  readonly status: WorkflowInstanceStatus
  /**
   * The node that is currently active (awaiting approval / running).
   * Null while a parallel frame is in flight — the per-branch activity
   * is tracked in `parallelFrames` instead.
   */
  readonly currentNodeId: string | null
  readonly history: readonly WorkflowHistoryEntry[]
  /**
   * Outcome populated when `status === 'completed'`. Mirrors the
   * terminal node's `outcome` field so hosts don't have to re-walk
   * the history to learn the result.
   */
  readonly outcome?: WorkflowOutcome
  /**
   * Active parallel frames, outermost first. Empty / undefined when
   * the workflow is linear.
   */
  readonly parallelFrames?: readonly WorkflowParallelFrame[]
}

// ─── Layout (Phase 2 visual builder — side-car, NOT part of Workflow) ─────

/**
 * Cosmetic node coordinates for the visual builder. Stored alongside a
 * `Workflow` rather than on its nodes so the runtime contract (schema +
 * interpreter) stays free of UI-only data. The interpreter ignores this
 * entirely; `advance()`, `findNode`, and `resolveNextEdge` never read it.
 */
export interface WorkflowLayout {
  readonly workflowId: string
  readonly workflowVersion: number
  readonly positions: Readonly<Record<string, { readonly x: number; readonly y: number }>>
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Look up a node by id. Returns undefined when missing. */
export function findNode(
  workflow: Workflow,
  nodeId: string,
): WorkflowNode | undefined {
  return workflow.nodes.find(n => n.id === nodeId)
}

/**
 * Return the edge matching a source + emitted signal, using the
 * priority order:
 *
 *   1. exact `when === signal` match
 *   2. `when === 'branch-completed'` when the signal is a branch-
 *      terminating one (`approved` / `denied` / `timeout`), so branches
 *      inside a parallel scope can route to the paired join without
 *      double-wiring both outcomes.
 *   3. default edge (`when === undefined` or `when === 'default'`)
 *
 * Returns undefined when nothing matches — callers treat that as a
 * workflow failure.
 */
export function resolveNextEdge(
  workflow: Workflow,
  fromNodeId: string,
  signal: EdgeGuard,
): WorkflowEdge | undefined {
  let defaultEdge: WorkflowEdge | undefined
  let branchCompletedEdge: WorkflowEdge | undefined
  for (const edge of workflow.edges) {
    if (edge.from !== fromNodeId) continue
    if (edge.when === signal) return edge
    if (edge.when === 'branch-completed') {
      branchCompletedEdge = edge
    } else if (edge.when === undefined || edge.when === 'default') {
      defaultEdge = edge
    }
  }
  if (
    branchCompletedEdge &&
    (signal === 'approved' || signal === 'denied' || signal === 'timeout')
  ) {
    return branchCompletedEdge
  }
  return defaultEdge
}
