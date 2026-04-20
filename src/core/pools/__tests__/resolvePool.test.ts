/**
 * resolvePool — unit specs (issue #212).
 *
 * Pool resolution is a pure function that chooses a concrete resource
 * from a virtual pool before a booking is written. Strategy behavior
 * is pinned here so the submit-flow can rely on deterministic choices.
 */
import { describe, it, expect } from 'vitest'
import { resolvePool } from '../resolvePool'
import type { ResourcePool } from '../resourcePoolSchema'
import type { ConflictEvent, ConflictRule } from '../../conflictEngine'
import { makeAssignment } from '../../engine/schema/assignmentSchema'

const winStart = new Date(Date.UTC(2026, 3, 20, 9, 0))
const winEnd   = new Date(Date.UTC(2026, 3, 20, 11, 0))

const proposed: Omit<ConflictEvent, 'resource'> = {
  id: 'new',
  start: winStart,
  end: winEnd,
  category: 'flight',
}

const overlapRule: ConflictRule = { id: 'ovr', type: 'resource-overlap', severity: 'hard' }

describe('resolvePool — guard paths', () => {
  it('rejects disabled pools', () => {
    const pool: ResourcePool = {
      id: 'p', name: 'Disabled', memberIds: ['a'], strategy: 'first-available', disabled: true,
    }
    const result = resolvePool({ pool, proposed, events: [], rules: [] })
    expect(result).toMatchObject({ ok: false, error: { code: 'POOL_DISABLED' } })
  })

  it('rejects empty pools', () => {
    const pool: ResourcePool = {
      id: 'p', name: 'Empty', memberIds: [], strategy: 'first-available',
    }
    const result = resolvePool({ pool, proposed, events: [], rules: [] })
    expect(result).toMatchObject({ ok: false, error: { code: 'POOL_EMPTY' } })
  })

  it('rejects when every member is in hard conflict', () => {
    const pool: ResourcePool = {
      id: 'p', name: 'Full', memberIds: ['a', 'b'], strategy: 'first-available',
    }
    const events: ConflictEvent[] = [
      { id: 'e1', start: winStart, end: winEnd, resource: 'a' },
      { id: 'e2', start: winStart, end: winEnd, resource: 'b' },
    ]
    const result = resolvePool({ pool, proposed, events, rules: [overlapRule] })
    expect(result).toMatchObject({ ok: false, error: { code: 'NO_AVAILABLE_MEMBER' } })
  })
})

describe('resolvePool — first-available', () => {
  const pool: ResourcePool = {
    id: 'p', name: 'Drivers', memberIds: ['driver-1', 'driver-2', 'driver-3'],
    strategy: 'first-available',
  }

  it('picks the first member when none conflict', () => {
    const result = resolvePool({ pool, proposed, events: [], rules: [overlapRule] })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.resourceId).toBe('driver-1')
      expect(result.evaluated).toEqual(['driver-1'])
    }
  })

  it('skips members with hard conflicts and picks the next', () => {
    const events: ConflictEvent[] = [
      { id: 'e1', start: winStart, end: winEnd, resource: 'driver-1' },
    ]
    const result = resolvePool({ pool, proposed, events, rules: [overlapRule] })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.resourceId).toBe('driver-2')
      expect(result.evaluated).toEqual(['driver-1', 'driver-2'])
    }
  })

  it('preserves member order — does not permute', () => {
    const result = resolvePool({
      pool: { ...pool, memberIds: ['z', 'a', 'm'] },
      proposed, events: [], rules: [overlapRule],
    })
    expect(result.ok && result.resourceId).toBe('z')
  })
})

describe('resolvePool — least-loaded', () => {
  const pool: ResourcePool = {
    id: 'p', name: 'Rooms', memberIds: ['r1', 'r2', 'r3'], strategy: 'least-loaded',
  }

  it('picks the member with the lowest overlapping workload', () => {
    // r1 = 2 events, r2 = 1 event, r3 = 0 events.
    const events: ConflictEvent[] = [
      { id: 'a', start: winStart, end: winEnd, resource: 'r1' },
      { id: 'b', start: winStart, end: winEnd, resource: 'r1' },
      { id: 'c', start: winStart, end: winEnd, resource: 'r2' },
    ]
    const result = resolvePool({ pool, proposed, events, rules: [] })
    expect(result.ok && result.resourceId).toBe('r3')
  })

  it('uses Assignment units when provided', () => {
    // Restrict to r1 + r2 for this test: r1=50 units, r2=100 → r1 wins.
    const scopedPool: ResourcePool = { ...pool, memberIds: ['r1', 'r2'] }
    const events: ConflictEvent[] = [
      { id: 'half', start: winStart, end: winEnd, resource: 'r1' },
      { id: 'full', start: winStart, end: winEnd, resource: 'r2' },
    ]
    const assignments = new Map([
      ['asg-half', makeAssignment('asg-half', { eventId: 'half', resourceId: 'r1', units: 50 })],
      ['asg-full', makeAssignment('asg-full', { eventId: 'full', resourceId: 'r2', units: 100 })],
    ])
    const result = resolvePool({ pool: scopedPool, proposed, events, rules: [], assignments })
    expect(result.ok && result.resourceId).toBe('r1')
  })

  it('breaks ties by member order (stable)', () => {
    const events: ConflictEvent[] = []
    const result = resolvePool({ pool, proposed, events, rules: [] })
    expect(result.ok && result.resourceId).toBe('r1')
  })

  it('ignores events outside the proposed window', () => {
    const events: ConflictEvent[] = [
      {
        id: 'earlier', resource: 'r1',
        start: new Date(Date.UTC(2026, 3, 20, 6, 0)),
        end:   new Date(Date.UTC(2026, 3, 20, 7, 0)),
      },
    ]
    const result = resolvePool({ pool, proposed, events, rules: [] })
    expect(result.ok && result.resourceId).toBe('r1')
  })
})

describe('resolvePool — round-robin', () => {
  const pool: ResourcePool = {
    id: 'p', name: 'Agents', memberIds: ['a', 'b', 'c'], strategy: 'round-robin',
  }

  it('starts at index 0 when cursor is undefined', () => {
    const result = resolvePool({ pool, proposed, events: [], rules: [] })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.resourceId).toBe('a')
      expect(result.rrCursor).toBe(0)
    }
  })

  it('advances past the previous cursor', () => {
    const result = resolvePool({
      pool: { ...pool, rrCursor: 0 },
      proposed, events: [], rules: [],
    })
    expect(result.ok && result.resourceId).toBe('b')
    if (result.ok) expect(result.rrCursor).toBe(1)
  })

  it('wraps around when the cursor reaches the end', () => {
    const result = resolvePool({
      pool: { ...pool, rrCursor: 2 },
      proposed, events: [], rules: [],
    })
    expect(result.ok && result.resourceId).toBe('a')
    if (result.ok) expect(result.rrCursor).toBe(0)
  })

  it('skips members in hard conflict and returns the chosen index as the new cursor', () => {
    const events: ConflictEvent[] = [
      { id: 'e1', start: winStart, end: winEnd, resource: 'b' },
    ]
    const result = resolvePool({
      pool: { ...pool, rrCursor: 0 }, // next = b, but b is busy → c
      proposed, events, rules: [overlapRule],
    })
    expect(result.ok && result.resourceId).toBe('c')
    if (result.ok) expect(result.rrCursor).toBe(2)
  })
})

describe('resolvePool — evaluated trail', () => {
  it('lists every member tried before the winner in order', () => {
    const pool: ResourcePool = {
      id: 'p', name: 'X', memberIds: ['a', 'b', 'c', 'd'], strategy: 'first-available',
    }
    const events: ConflictEvent[] = [
      { id: 'e1', start: winStart, end: winEnd, resource: 'a' },
      { id: 'e2', start: winStart, end: winEnd, resource: 'b' },
    ]
    const result = resolvePool({ pool, proposed, events, rules: [overlapRule] })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.evaluated).toEqual(['a', 'b', 'c'])
  })
})
