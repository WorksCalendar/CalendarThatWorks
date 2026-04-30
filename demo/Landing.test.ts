/**
 * Regression test for the chrome-level approval queue.
 *
 * The bug: dragging an approval-tagged event (e.g. an aircraft request that
 * shares a row with the São Paulo → Munich mission) wrote a Date back into
 * the demo's `events` state via the calendar's onEventSave round-trip.
 * Landing's `splitApprovalQueues` then sorted those items with
 * `b.start.localeCompare(a.start)` — Date doesn't have `.localeCompare`, so
 * the chrome crashed with `i.start.localeCompare is not a function` the
 * moment React re-rendered after the drop.
 *
 * Fix: coerce `ev.start` to ISO string at the boundary so the comparator
 * stays type-safe regardless of whether the host hands us strings or
 * Dates. This test pins the crash by feeding mixed string/Date starts.
 */
import { describe, it, expect } from 'vitest';
import { splitApprovalQueues } from './Landing';
import { findProfile } from './profiles';

describe('splitApprovalQueues', () => {
  const opsManager = findProfile('ops-manager');

  it('does not crash when an approval event has a Date start (post-drag/save shape)', () => {
    const events = [
      // String start — initial event shape from INITIAL_EVENTS.
      { id: 'req-a', title: 'Lift Request – A', start: '2026-04-23T08:00',
        category: 'aircraft-request',
        meta: { approvalStage: { stage: 'requested' } } },
      // Date start — what the calendar emits via onEventSave after a move.
      { id: 'req-b', title: 'Lift Request – B', start: new Date(2026, 3, 24, 9, 0),
        category: 'aircraft-request',
        meta: { approvalStage: { stage: 'requested' } } },
    ];

    expect(() => splitApprovalQueues(events, opsManager)).not.toThrow();
    const { awaiting } = splitApprovalQueues(events, opsManager);
    expect(awaiting.map(i => i.id)).toEqual(['req-b', 'req-a']); // sorted DESC by start
    // Items are normalized to string starts so downstream renderers stay
    // string-typed.
    awaiting.forEach(i => expect(typeof i.start).toBe('string'));
  });

  it('keeps working with all-string starts (legacy shape)', () => {
    const events = [
      { id: 'req-a', title: 'A', start: '2026-04-23T08:00',
        category: 'aircraft-request',
        meta: { approvalStage: { stage: 'requested' } } },
      { id: 'req-b', title: 'B', start: '2026-04-25T09:00',
        category: 'aircraft-request',
        meta: { approvalStage: { stage: 'requested' } } },
    ];
    const { awaiting } = splitApprovalQueues(events, opsManager);
    expect(awaiting.map(i => i.id)).toEqual(['req-b', 'req-a']);
  });
});
