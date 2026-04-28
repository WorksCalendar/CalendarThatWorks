/**
 * `computeOccurrenceEnd` — DST-aware wall-clock end-time preservation (#258).
 *
 * The function preserves the UTC delta when `tz` is unset, and the
 * wall-clock delta when `tz` is provided. The boundary cases worth
 * proving are spring-forward (a wall-clock hour disappears) and
 * fall-back (a wall-clock hour repeats).
 */
import { describe, it, expect } from 'vitest';
import { computeOccurrenceEnd } from '../time/wallClock';
import { partsInTimezone } from '../time/timezone';

const NY = 'America/New_York';
const UTC = 'UTC';
const TOKYO = 'Asia/Tokyo';

const HOUR = 3_600_000;

describe('computeOccurrenceEnd — no timezone (legacy / floating)', () => {
  it('falls back to UTC addition when tz is undefined', () => {
    const start = new Date('2026-01-15T12:00:00Z');
    expect(computeOccurrenceEnd(start, 2 * HOUR).toISOString())
      .toBe('2026-01-15T14:00:00.000Z');
  });

  it('falls back to UTC addition when tz is null', () => {
    const start = new Date('2026-01-15T12:00:00Z');
    expect(computeOccurrenceEnd(start, 2 * HOUR, null).toISOString())
      .toBe('2026-01-15T14:00:00.000Z');
  });

  it('falls back to UTC addition when tz is empty string', () => {
    const start = new Date('2026-01-15T12:00:00Z');
    expect(computeOccurrenceEnd(start, 2 * HOUR, '').toISOString())
      .toBe('2026-01-15T14:00:00.000Z');
  });
});

describe('computeOccurrenceEnd — timezones without DST', () => {
  it('UTC: 2h addition is identical to plain math', () => {
    const start = new Date('2026-01-15T12:00:00Z');
    expect(computeOccurrenceEnd(start, 2 * HOUR, UTC).toISOString())
      .toBe('2026-01-15T14:00:00.000Z');
  });

  it('Asia/Tokyo (no DST): 2h addition is identical to plain math', () => {
    const start = new Date('2026-01-15T12:00:00Z'); // 21:00 JST
    const end = computeOccurrenceEnd(start, 2 * HOUR, TOKYO);
    expect(end.toISOString()).toBe('2026-01-15T14:00:00.000Z');
    // Wall-clock end is 23:00 JST.
    expect(partsInTimezone(end, TOKYO).hour).toBe(23);
  });
});

describe('computeOccurrenceEnd — spring-forward', () => {
  // 2026 US spring-forward: 2026-03-08, clocks jump 02:00 → 03:00.
  // 01:00 EST is 06:00 UTC. 03:00 EDT is 07:00 UTC.
  const startEST = new Date('2026-03-08T06:00:00Z'); // 01:00 EST

  it('a 2h event ending past the gap finishes at 03:00 wall-clock, not 04:00', () => {
    const end = computeOccurrenceEnd(startEST, 2 * HOUR, NY);
    expect(end.toISOString()).toBe('2026-03-08T07:00:00.000Z');
    // Wall-clock confirmation.
    const parts = partsInTimezone(end, NY);
    expect(parts.hour).toBe(3);
    expect(parts.minute).toBe(0);
  });

  it('UTC delta for that event is 1h (the gap eats one hour of UTC time)', () => {
    const end = computeOccurrenceEnd(startEST, 2 * HOUR, NY);
    expect(end.getTime() - startEST.getTime()).toBe(1 * HOUR);
  });

  it('plain UTC math (no tz) keeps a 2h UTC delta and lands at 04:00 EDT (the bug we fix)', () => {
    const end = computeOccurrenceEnd(startEST, 2 * HOUR);
    expect(partsInTimezone(end, NY).hour).toBe(4);
  });
});

describe('computeOccurrenceEnd — fall-back', () => {
  // 2026 US fall-back: 2026-11-01, clocks fall 02:00 → 01:00.
  // 01:00 EDT (the first 1:00) is 05:00 UTC.
  // Wall-clock 03:00 EST (after fold) is 08:00 UTC.
  const startEDT = new Date('2026-11-01T05:00:00Z'); // 01:00 EDT (first occurrence)

  it('a 2h event finishes at 03:00 wall-clock (post-fold)', () => {
    const end = computeOccurrenceEnd(startEDT, 2 * HOUR, NY);
    expect(end.toISOString()).toBe('2026-11-01T08:00:00.000Z');
    const parts = partsInTimezone(end, NY);
    expect(parts.hour).toBe(3);
  });

  it('UTC delta is 3h (the fold inserts an extra hour of UTC time)', () => {
    const end = computeOccurrenceEnd(startEDT, 2 * HOUR, NY);
    expect(end.getTime() - startEDT.getTime()).toBe(3 * HOUR);
  });

  it('plain UTC math (no tz) keeps a 2h UTC delta and lands at 02:00 EST', () => {
    const end = computeOccurrenceEnd(startEDT, 2 * HOUR);
    expect(partsInTimezone(end, NY).hour).toBe(2);
  });
});

describe('computeOccurrenceEnd — sub-hour and cross-day', () => {
  it('preserves a 30-minute wall-clock delta across spring-forward', () => {
    // Start at 01:30 EST → +30m wall-clock → 02:00 wall-clock,
    // which is in the gap. wallClockToUtc snaps to post-DST.
    const start = new Date('2026-03-08T06:30:00Z'); // 01:30 EST
    const end = computeOccurrenceEnd(start, 30 * 60_000, NY);
    // Snapped wall-clock is 03:00 EDT = 07:00 UTC.
    expect(end.toISOString()).toBe('2026-03-08T07:00:00.000Z');
  });

  it('crossing midnight stays correct on a non-DST day', () => {
    const start = new Date('2026-01-15T04:30:00Z'); // 23:30 EST (Jan 14)
    const end = computeOccurrenceEnd(start, 2 * HOUR, NY);
    // Wall-clock end: 01:30 EST on Jan 15.
    const parts = partsInTimezone(end, NY);
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(1);
    expect(parts.day).toBe(15);
    expect(parts.hour).toBe(1);
    expect(parts.minute).toBe(30);
  });
});
