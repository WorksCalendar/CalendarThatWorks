/**
 * CalendarEngine — timezone utilities.
 *
 * Wraps the Intl API for timezone-aware date operations.
 * All functions are pure (no side effects).
 *
 * Strategy: store and transmit dates as UTC (JS Date objects).
 * Convert to/from the display timezone only at the view boundary.
 */

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * Return the IANA timezone identifier for the current browser/runtime.
 * Falls back to "UTC" if detection fails.
 */
export function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/** True if the given IANA timezone identifier is valid. */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ─── Display formatting ───────────────────────────────────────────────────────

/**
 * Format a Date in a specific IANA timezone.
 * Returns a plain object with numeric date/time parts.
 */
export function partsInTimezone(
  d: Date,
  tz: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false,
  });

  const parts = Object.fromEntries(
    fmt.formatToParts(d).map(p => [p.type, p.value]),
  );

  return {
    year:   parseInt(parts['year']   ?? '0', 10),
    month:  parseInt(parts['month']  ?? '0', 10),
    day:    parseInt(parts['day']    ?? '0', 10),
    hour:   parseInt(parts['hour']   ?? '0', 10) % 24, // hour12=false can give 24
    minute: parseInt(parts['minute'] ?? '0', 10),
    second: parseInt(parts['second'] ?? '0', 10),
  };
}

/**
 * Get the UTC offset (in minutes) of a timezone at a specific instant.
 * Positive = east of UTC (e.g. +60 = UTC+1), negative = west.
 */
export function utcOffsetMinutes(d: Date, tz: string): number {
  const parts = partsInTimezone(d, tz);
  // Build the wall-clock time as if it were UTC, then compute difference
  const wallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const offsetMs  = wallAsUtc - d.getTime();
  // Round to nearest minute to avoid sub-minute DST quirks
  return Math.round(offsetMs / 60_000);
}

// ─── Conversion ───────────────────────────────────────────────────────────────

/**
 * Convert a "wall clock" date (year/month/day/hour/minute in a timezone)
 * to a UTC Date object.
 *
 * Example: 9:00 AM in America/Denver → UTC Date
 *
 * DST-aware (#258): a single offset pass picks the wrong side of the
 * transition when the wall-clock target sits across it, so we try
 * both candidate offsets and pick whichever round-trips cleanly via
 * `partsInTimezone`.
 *
 *   - Outside DST transitions: candidate1 round-trips and is returned.
 *   - On the DST-active side of a fall-back: candidate1 lands an hour
 *     off; candidate2 (using the offset at candidate1's instant)
 *     round-trips correctly and is returned.
 *   - Spring-forward gap (a wall-clock time that doesn't exist):
 *     neither candidate round-trips. Default to candidate1 — the
 *     "snap forward" mapping (skip the missing hour) — because a
 *     duration that lands in the gap is almost always meant to extend
 *     past it rather than collapse before it.
 *   - Fall-back fold (an ambiguous wall-clock time that repeats):
 *     candidate1's first round-trip wins, which is the earlier (DST-
 *     active) of the two — matches common library convention.
 */
export function wallClockToUtc(
  year: number,
  month: number, // 1-based
  day: number,
  hour: number,
  minute: number,
  second: number,
  tz: string,
): Date {
  const approxUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const target = { year, month, day, hour, minute, second };

  const offset1 = utcOffsetMinutes(approxUtc, tz);
  const candidate1 = new Date(approxUtc.getTime() - offset1 * 60_000);
  if (matchesWallClock(candidate1, tz, target)) return candidate1;

  const offset2 = utcOffsetMinutes(candidate1, tz);
  if (offset2 === offset1) return candidate1;
  const candidate2 = new Date(approxUtc.getTime() - offset2 * 60_000);
  if (matchesWallClock(candidate2, tz, target)) return candidate2;

  // Wall-clock time doesn't exist in this tz on this date (spring-
  // forward gap). Default to candidate1 — see fn comment.
  return candidate1;
}

function matchesWallClock(
  d: Date,
  tz: string,
  target: { year: number; month: number; day: number; hour: number; minute: number; second: number },
): boolean {
  const p = partsInTimezone(d, tz);
  return p.year === target.year && p.month === target.month && p.day === target.day
      && p.hour === target.hour && p.minute === target.minute && p.second === target.second;
}

/**
 * Return the "local" hours decimal (0..24) for a date in the given timezone.
 * Useful for positioning events on a time grid.
 */
export function hoursInTimezone(d: Date, tz: string): number {
  const p = partsInTimezone(d, tz);
  return p.hour + p.minute / 60 + p.second / 3600;
}

// ─── Event timezone handling ──────────────────────────────────────────────────

/**
 * Normalize an event's start/end from its stored timezone to the display
 * timezone.
 *
 * For floating events (timezone === null), start/end are already in local time
 * and are returned unchanged.
 */
export function convertEventToDisplayZone(
  start: Date,
  end: Date,
  eventTz: string | null,
  displayTz: string | null,
): { start: Date; end: Date } {
  // If either timezone is null (floating), no conversion needed
  if (!eventTz || !displayTz || eventTz === displayTz) {
    return { start, end };
  }

  // JS Date is always UTC internally; Intl handles display conversion.
  // No data transformation needed — the same Date object displays
  // differently depending on the timezone used for formatting.
  return { start, end };
}
