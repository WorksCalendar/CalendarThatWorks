/**
 * Regression tests for the chrome-level approval queue.
 *
 * Two bugs covered here:
 *
 * 1. Crash on Date starts. Dragging an approval-tagged event in the calendar
 *    rewrote `events[i].start` as a real Date via the calendar's onEventSave
 *    round-trip. Landing's splitApprovalQueues then sorted with
 *    `b.start.localeCompare(a.start)` — Date doesn't have `.localeCompare`,
 *    so the chrome's useMemo crashed on the next render with
 *    `i.start.localeCompare is not a function`.
 *
 * 2. Mixed-format ordering. Coercing only Date → ISO (`...Z`) while leaving
 *    naive local strings (`YYYY-MM-DDTHH:mm`) untouched mixes UTC and local
 *    in the same lexical sort key, which inverts chronology in non-UTC
 *    timezones. Comparing epoch ms removes the format axis entirely.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { splitApprovalQueues } from './Landing';
import { findProfile } from './profiles';

const opsManager = findProfile('ops-manager');

describe('splitApprovalQueues', () => {
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

  describe('mixed naive-string and UTC-Date ordering (Codex P2 review)', () => {
    // Simulate a US-Pacific run where one event lives in INITIAL_EVENTS as a
    // naive local-time string and another came back from the calendar as a
    // Date (which serialises to UTC ISO with a `Z` suffix). Pure lexical
    // comparison would invert these because `2026-04-25T07:45:00.000Z` >
    // `2026-04-25T00:30` as strings even though the Date is *earlier* in
    // local time. We pin TZ via process.env so the test is deterministic.
    let originalTZ: string | undefined;

    beforeEach(() => {
      originalTZ = process.env['TZ'];
      process.env['TZ'] = 'America/Los_Angeles';
    });
    afterEach(() => {
      process.env['TZ'] = originalTZ;
    });

    it('orders chronologically when one start is a naive string and the other is a Date', () => {
      // local 2026-04-24 23:45 PDT (which is 2026-04-25T06:45Z)
      const earlierAsDate = new Date('2026-04-25T06:45:00.000Z');
      // naive 2026-04-25 00:30 → in PDT this is 2026-04-25T07:30Z, *later*.
      const laterAsString = '2026-04-25T00:30';

      const events = [
        { id: 'earlier', title: 'Earlier (Date)', start: earlierAsDate,
          category: 'aircraft-request',
          meta: { approvalStage: { stage: 'requested' } } },
        { id: 'later', title: 'Later (string)', start: laterAsString,
          category: 'aircraft-request',
          meta: { approvalStage: { stage: 'requested' } } },
      ];

      const { awaiting } = splitApprovalQueues(events, opsManager);
      // Most-recent-first: laterAsString must come before earlierAsDate.
      expect(awaiting.map(i => i.id)).toEqual(['later', 'earlier']);
    });
  });
});
