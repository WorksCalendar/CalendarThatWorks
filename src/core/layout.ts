/**
 * layout.js — shared event layout algorithms.
 *
 *   layoutOverlaps  — column-pack timed events that share the same time slot
 *   layoutSpans     — lane-pack multi-day events for month/all-day row rendering
 */
import { differenceInCalendarDays, addDays } from 'date-fns';

type LayoutEvent = {
  start: Date;
  end: Date;
  allDay?: boolean | undefined;
  [k: string]: any;
};

// ─── Timed event overlap layout (week / day view) ──────────────────────────

/**
 * Assign non-overlapping horizontal columns to a set of timed events.
 *
 * @param {LayoutEvent[]} events
 * @returns {Array<LayoutEvent & { _col: number; _numCols: number }>}
 */
export function layoutOverlaps<T extends LayoutEvent>(
  events: T[],
): Array<T & { _col: number; _numCols: number }> {
  if (!events.length) return [];

  // Sort by start time, then longer events first for visual stability
  const sorted = [...events].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
      || (b.end.getTime() - b.start.getTime()) - (a.end.getTime() - a.start.getTime()),
  );

  const colEnds: Date[] = []; // colEnds[i] = end time of the last event placed in column i

  const withCols = sorted.map(ev => {
    const col = colEnds.findIndex(end => end <= ev.start);
    const assigned = col === -1 ? colEnds.length : col;
    colEnds[assigned] = ev.end;
    return { ...ev, _col: assigned };
  });

  const numCols = colEnds.length;
  return withCols.map(ev => ({ ...ev, _numCols: numCols }));
}

// ─── Multi-day event span layout (month view / all-day row) ───────────────

/**
 * Return the start of the UTC calendar day that contains `d`.
 * Using UTC avoids local-timezone shifts that would cause `startOfDay` from
 * date-fns (which respects local time) to return the wrong calendar day when
 * the host machine is not in UTC.
 */
function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * The "display end day" of an event — the last calendar day the event
 * occupies (inclusive), accounting for exclusive all-day ends.
 *
 * All calculations are performed in UTC to ensure consistent behaviour
 * regardless of the host machine's local timezone.
 */
export function displayEndDay(ev: LayoutEvent): Date {
  const end = ev.end;
  // Work in UTC to stay timezone-independent.
  const day = startOfUTCDay(end);
  const atMidnight = end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0;
  if (ev.allDay) {
    // All-day events use iCal's exclusive DTEND convention:
    // DTEND=Jan4 means the event covers Jan1–Jan3, not Jan4.
    return atMidnight ? addDays(day, -1) : day;
  }
  // Timed events that end exactly at midnight and started on an earlier date
  // should not "occupy" the boundary day in month-span lane packing.
  // This prevents adjacent back-to-back rotations from double-stacking.
  // Use UTC-based same-day check to match our UTC day boundary.
  const startUTCDay = startOfUTCDay(ev.start);
  if (atMidnight && startUTCDay.getTime() !== day.getTime()) return addDays(day, -1);
  // Otherwise, timed events use their real end day.
  return day;
}

/**
 * Pack multi-day (spanning) events into non-overlapping lanes for one week row.
 *
 * @param {LayoutEvent[]} events   — already filtered to multi-day events
 * @param {Date}              weekStart — first day (Monday/Sunday) of the week row
 * @param {Date}              weekEnd   — last day of the week row
 * @returns {Array<{
 *   ev: LayoutEvent;
 *   startCol: number;      // 0–6, clipped to week
 *   endCol: number;        // 0–6, clipped to week (inclusive)
 *   lane: number;
 *   continuesBefore: boolean;
 *   continuesAfter: boolean;
 * }>}
 */
export type LayoutSpanItem<T extends LayoutEvent = LayoutEvent> = {
  ev: T;
  evStartDay: Date;
  evEndDay: Date;
  startCol: number;
  endCol: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
  lane: number;
};

export function layoutSpans<T extends LayoutEvent>(
  events: T[],
  weekStart: Date,
  weekEnd: Date,
): LayoutSpanItem<T>[] {
  // Normalise weekStart/weekEnd to UTC day boundaries so all comparisons are
  // consistent with displayEndDay (which is also UTC-based).
  const weekStartUTC = startOfUTCDay(weekStart);
  const weekEndUTC   = startOfUTCDay(weekEnd);

  const items = events
    .map(ev => {
      const evStartDay = startOfUTCDay(ev.start);
      const evEndDay   = displayEndDay(ev);
      return {
        ev,
        evStartDay,
        evEndDay,
        startCol: Math.max(0, differenceInCalendarDays(evStartDay, weekStartUTC)),
        endCol:   Math.min(6, differenceInCalendarDays(evEndDay,   weekStartUTC)),
        continuesBefore: evStartDay < weekStartUTC,
        continuesAfter:  evEndDay   > weekEndUTC,
      };
    })
    // Must actually overlap this week
    .filter(item => item.evStartDay <= weekEndUTC && item.evEndDay >= weekStartUTC)
    // Sort by visual start position, then longer spans first
    .sort((a, b) => a.startCol - b.startCol || (b.endCol - b.startCol) - (a.endCol - a.startCol));

  const laneEnds: number[] = []; // laneEnds[i] = last endCol placed in lane i

  return items.map(item => {
    let lane = laneEnds.findIndex(end => end < item.startCol);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = item.endCol;
    return { ...item, lane };
  });
}
