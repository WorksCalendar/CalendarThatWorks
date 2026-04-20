/**
 * Resource pool schema — issue #212.
 *
 * A `ResourcePool` is a virtual grouping of concrete resources ("any
 * available driver", "any meeting room ≥ 8 seats"). Bookings target the
 * pool id; at submit time the resolver picks one concrete member using
 * the configured strategy.
 *
 * Only the schema lives here. The resolver — which reads conflicts /
 * assignments to pick a member — lives in `resolvePool.ts`.
 */

export type PoolStrategy =
  | 'first-available'
  | 'least-loaded'
  | 'round-robin'

export interface ResourcePool {
  readonly id: string
  readonly name: string
  /**
   * Ordered ids of concrete `EngineResource`s in the pool. The order
   * drives `first-available` and `round-robin`; `least-loaded` re-sorts
   * by workload.
   */
  readonly memberIds: readonly string[]
  readonly strategy: PoolStrategy
  /**
   * Optional cursor persisted by the host for round-robin. Monotonic;
   * the resolver returns an updated cursor on each resolve so the host
   * can persist it back.
   */
  readonly rrCursor?: number
  /** Disabled pools stay in history but can't be selected for new bookings. */
  readonly disabled?: boolean
}
