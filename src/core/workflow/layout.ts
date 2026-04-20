/**
 * Workflow layout — Phase 2 visual builder.
 *
 * Pure function that computes SVG positions for each node and an
 * orthogonal path per edge. BFS from `startNodeId` determines the row
 * (rank); order-of-first-visit within a rank determines the column.
 * User-provided `WorkflowLayout.positions` always wins over the
 * auto-computed values.
 */
import { type Workflow, type WorkflowLayout } from './workflowSchema'

export const NODE_WIDTH = 140
export const NODE_HEIGHT = 56
export const COLUMN_STEP = 180
export const ROW_STEP = 120
export const GRID_SNAP = 20
const MARGIN = 40

export interface NodePosition {
  readonly x: number
  readonly y: number
}

export interface EdgePath {
  readonly from: string
  readonly to: string
  readonly d: string
  readonly midpoint: NodePosition
  readonly guard?: string
}

export interface LayoutResult {
  readonly positions: Readonly<Record<string, NodePosition>>
  readonly size: { readonly w: number; readonly h: number }
  readonly edgePaths: readonly EdgePath[]
}

export function layoutWorkflow(
  workflow: Workflow,
  overrides?: WorkflowLayout | null,
): LayoutResult {
  const ranks = bfsRanks(workflow)
  const columnsInRank = new Map<number, number>()
  const auto: Record<string, NodePosition> = {}

  for (const node of workflow.nodes) {
    const rank = ranks.get(node.id) ?? 0
    const col = columnsInRank.get(rank) ?? 0
    columnsInRank.set(rank, col + 1)
    auto[node.id] = {
      x: MARGIN + col * COLUMN_STEP,
      y: MARGIN + rank * ROW_STEP,
    }
  }

  const positions: Record<string, NodePosition> = {}
  for (const node of workflow.nodes) {
    const override = overrides?.positions?.[node.id]
    positions[node.id] = override ?? auto[node.id]
  }

  let maxX = 0
  let maxY = 0
  for (const pos of Object.values(positions)) {
    if (pos.x + NODE_WIDTH > maxX) maxX = pos.x + NODE_WIDTH
    if (pos.y + NODE_HEIGHT > maxY) maxY = pos.y + NODE_HEIGHT
  }

  const edgePaths: EdgePath[] = workflow.edges.map(edge => {
    const a = positions[edge.from]
    const b = positions[edge.to]
    if (!a || !b) {
      return { from: edge.from, to: edge.to, d: '', midpoint: { x: 0, y: 0 }, guard: edge.when }
    }
    return edge.from === edge.to
      ? selfLoopPath(edge, a)
      : a.y >= b.y
        ? backEdgePath(edge, a, b)
        : forwardEdgePath(edge, a, b)
  })

  return {
    positions,
    size: { w: maxX + MARGIN, h: maxY + MARGIN },
    edgePaths,
  }
}

export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SNAP) * GRID_SNAP
}

function forwardEdgePath(
  edge: { from: string; to: string; when?: string },
  a: NodePosition,
  b: NodePosition,
): EdgePath {
  const ax = a.x + NODE_WIDTH / 2
  const ay = a.y + NODE_HEIGHT
  const bx = b.x + NODE_WIDTH / 2
  const by = b.y
  const midY = (ay + by) / 2
  return {
    from: edge.from,
    to: edge.to,
    d: `M ${ax} ${ay} L ${ax} ${midY} L ${bx} ${midY} L ${bx} ${by}`,
    midpoint: { x: (ax + bx) / 2, y: midY },
    guard: edge.when,
  }
}

/**
 * Back-edge (target rank ≤ source rank) — detours through a channel to
 * the left of the graph so the line is visible and can't be confused
 * with forward edges.
 */
function backEdgePath(
  edge: { from: string; to: string; when?: string },
  a: NodePosition,
  b: NodePosition,
): EdgePath {
  const ax = a.x
  const ay = a.y + NODE_HEIGHT / 2
  const bx = b.x
  const by = b.y + NODE_HEIGHT / 2
  const channelX = Math.min(ax, bx) - 40
  return {
    from: edge.from,
    to: edge.to,
    d: `M ${ax} ${ay} L ${channelX} ${ay} L ${channelX} ${by} L ${bx} ${by}`,
    midpoint: { x: channelX, y: (ay + by) / 2 },
    guard: edge.when,
  }
}

function selfLoopPath(
  edge: { from: string; to: string; when?: string },
  a: NodePosition,
): EdgePath {
  const rx = a.x + NODE_WIDTH
  const ry = a.y + NODE_HEIGHT / 2
  const loopX = rx + 32
  return {
    from: edge.from,
    to: edge.to,
    d: `M ${rx} ${ry} C ${loopX} ${ry - 32}, ${loopX} ${ry + 32}, ${rx} ${ry}`,
    midpoint: { x: loopX, y: ry },
    guard: edge.when,
  }
}

function bfsRanks(workflow: Workflow): Map<string, number> {
  const ranks = new Map<string, number>()
  const present = new Set(workflow.nodes.map(n => n.id))
  if (!present.has(workflow.startNodeId)) {
    // Fall back to row 0 for all nodes so the layout is still defined.
    workflow.nodes.forEach(n => ranks.set(n.id, 0))
    return ranks
  }
  ranks.set(workflow.startNodeId, 0)
  const queue: string[] = [workflow.startNodeId]
  while (queue.length > 0) {
    const id = queue.shift() as string
    const rank = ranks.get(id) ?? 0
    for (const edge of workflow.edges) {
      if (edge.from !== id) continue
      if (!present.has(edge.to)) continue
      if (!ranks.has(edge.to)) {
        ranks.set(edge.to, rank + 1)
        queue.push(edge.to)
      }
    }
  }
  // Nodes unreachable from start still need a row — pile them below.
  let orphanRank = (Math.max(0, ...Array.from(ranks.values())) ?? 0) + 1
  for (const node of workflow.nodes) {
    if (!ranks.has(node.id)) {
      ranks.set(node.id, orphanRank)
      orphanRank++
    }
  }
  return ranks
}
