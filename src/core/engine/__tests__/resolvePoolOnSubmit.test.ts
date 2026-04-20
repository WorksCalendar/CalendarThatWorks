/**
 * Pool resolve on submit (issue #212) — end-to-end through
 * CalendarEngine.applyMutation.
 *
 * Pins the behavior stated in the issue:
 *   - Event with resourcePoolId resolves to a concrete resourceId on
 *     the saved event.
 *   - meta.resolvedFromPoolId retained for audit.
 *   - Round-robin cursor advances and is visible on engine.getPool()
 *     in the same mutation (one _notify, atomic with the commit).
 *   - Exhausted / unknown pools surface a hard violation and do not
 *     mutate state.
 */
import { describe, it, expect } from 'vitest';
import { CalendarEngine } from '../CalendarEngine';
import type { ResourcePool } from '../../pools/resourcePoolSchema';
import type { EngineOperation } from '../schema/operationSchema';
import { makeEvent } from '../schema/eventSchema';

const START = new Date('2026-04-20T09:00:00Z');
const END   = new Date('2026-04-20T10:00:00Z');

function createOp(patch: Partial<Parameters<typeof makeEvent>[1]> = {}): EngineOperation {
  return {
    type:   'create',
    event: {
      title: 'booking',
      start: START,
      end:   END,
      ...patch,
    },
    source: 'api',
  };
}

function pool(patch: Partial<ResourcePool> & Pick<ResourcePool, 'id' | 'memberIds'>): ResourcePool {
  return {
    name:     patch.id.toUpperCase(),
    strategy: 'first-available',
    ...patch,
  };
}

describe('applyMutation — pool resolve on submit', () => {
  it('rewrites a create op to a concrete member and stashes the pool id', () => {
    const engine = new CalendarEngine({
      pools: [pool({ id: 'drivers', memberIds: ['d1', 'd2'] })],
    });

    const result = engine.applyMutation(createOp({ resourcePoolId: 'drivers' }));
    expect(result.status).toBe('accepted');

    const saved = Array.from(engine.state.events.values())[0];
    expect(saved.resourceId).toBe('d1');
    expect(saved.resourcePoolId).toBeNull();
    expect(saved.meta.resolvedFromPoolId).toBe('drivers');
    expect(saved.meta.poolEvaluated).toEqual(['d1']);
  });

  it('skips members in hard conflict and picks the next available', () => {
    const engine = new CalendarEngine({
      events: [makeEvent('blocker', {
        title: 'blocker', start: START, end: END, resourceId: 'd1',
      })],
      pools:  [pool({ id: 'drivers', memberIds: ['d1', 'd2'] })],
    });

    const result = engine.applyMutation(createOp({ resourcePoolId: 'drivers' }));
    expect(result.status).toBe('accepted');

    const saved = Array.from(engine.state.events.values()).find(e => e.id !== 'blocker')!;
    expect(saved.resourceId).toBe('d2');
    expect(saved.meta.poolEvaluated).toEqual(['d1', 'd2']);
  });

  it('advances the round-robin cursor and persists it in state', () => {
    const engine = new CalendarEngine({
      pools: [pool({ id: 'agents', memberIds: ['a', 'b', 'c'], strategy: 'round-robin' })],
    });

    const r1 = engine.applyMutation(createOp({ resourcePoolId: 'agents' }));
    expect(r1.status).toBe('accepted');
    expect(engine.getPool('agents')?.rrCursor).toBe(0);

    const r2 = engine.applyMutation(createOp({
      resourcePoolId: 'agents',
      start: new Date('2026-04-21T09:00:00Z'),
      end:   new Date('2026-04-21T10:00:00Z'),
    }));
    expect(r2.status).toBe('accepted');
    expect(engine.getPool('agents')?.rrCursor).toBe(1);

    const picked = Array.from(engine.state.events.values()).map(e => e.resourceId);
    expect(picked.sort()).toEqual(['a', 'b']);
  });

  it('rejects with a hard violation when every member is in conflict', () => {
    const engine = new CalendarEngine({
      events: [
        makeEvent('b1', { title: 'x', start: START, end: END, resourceId: 'd1' }),
        makeEvent('b2', { title: 'y', start: START, end: END, resourceId: 'd2' }),
      ],
      pools:  [pool({ id: 'drivers', memberIds: ['d1', 'd2'] })],
    });

    const before = engine.state.events;
    const result = engine.applyMutation(createOp({ resourcePoolId: 'drivers' }));

    expect(result.status).toBe('rejected');
    expect(result.validation.severity).toBe('hard');
    expect(result.validation.violations[0]?.rule).toBe('pool-unresolvable');
    expect(result.validation.violations[0]?.details?.code).toBe('NO_AVAILABLE_MEMBER');
    expect(engine.state.events).toBe(before); // state unchanged
  });

  it('rejects when the pool id is unknown', () => {
    const engine = new CalendarEngine();
    const result = engine.applyMutation(createOp({ resourcePoolId: 'ghost' }));
    expect(result.status).toBe('rejected');
    expect(result.validation.violations[0]?.rule).toBe('pool-unresolvable');
    expect(result.validation.violations[0]?.details?.code).toBe('POOL_UNKNOWN');
  });

  it('leaves a concrete resourceId alone when both resourceId and resourcePoolId are set', () => {
    // Defensive: concrete wins. Pool is ignored and state does not advance.
    const engine = new CalendarEngine({
      pools: [pool({ id: 'agents', memberIds: ['a', 'b'], strategy: 'round-robin' })],
    });

    const result = engine.applyMutation(createOp({
      resourceId:     'preset',
      resourcePoolId: 'agents',
    }));
    expect(result.status).toBe('accepted');
    const saved = Array.from(engine.state.events.values())[0];
    expect(saved.resourceId).toBe('preset');
    expect(engine.getPool('agents')?.rrCursor).toBeUndefined();
  });

  it('passes through non-pool create ops unchanged', () => {
    const engine = new CalendarEngine();
    const result = engine.applyMutation(createOp({ resourceId: 'r1' }));
    expect(result.status).toBe('accepted');
    const saved = Array.from(engine.state.events.values())[0];
    expect(saved.resourceId).toBe('r1');
    expect(saved.meta.resolvedFromPoolId).toBeUndefined();
  });

  it('fires a single notify per mutation (event + pool commit are atomic)', () => {
    const engine = new CalendarEngine({
      pools: [pool({ id: 'agents', memberIds: ['a', 'b'], strategy: 'round-robin' })],
    });
    let notifications = 0;
    engine.subscribe(() => { notifications++; });

    engine.applyMutation(createOp({ resourcePoolId: 'agents' }));
    expect(notifications).toBe(1);
  });
});
