/**
 * CalendarEngine — adapter: EngineEvent → legacy event shape.
 *
 * Produces the shape consumed by the existing WorksCalendar views.
 * Use this when passing engine events to components that haven't been
 * migrated to the engine API yet.
 */

import type { EngineEvent } from '../schema/eventSchema.js';

// ─── Legacy shape ─────────────────────────────────────────────────────────────

export interface LegacyEventOut {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  category: string | null;
  color: string | null;
  resource: string | null;
  status: string;
  rrule: string | null;
  exdates: Date[];
  meta: Record<string, unknown>;
  /** Back-compat: _seriesId if this event is part of a series. */
  _seriesId: string | null;
  /** Back-compat: true if this is an expanded recurrence occurrence. */
  _recurring: boolean;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert a single EngineEvent to the legacy shape expected by views.
 *
 * Key transformations:
 *   - resourceId     → resource
 *   - seriesId       → _seriesId
 *   - isPartOfSeries → _recurring
 */
export function toLegacyEvent(ev: EngineEvent): LegacyEventOut {
  const isRecurring = ev.seriesId !== null && ev.seriesId !== ev.id;
  return {
    id:         ev.id,
    title:      ev.title,
    start:      ev.start,
    end:        ev.end,
    allDay:     ev.allDay,
    category:   ev.category,
    color:      ev.color,
    resource:   ev.resourceId,
    status:     ev.status,
    rrule:      ev.rrule,
    exdates:    Array.from(ev.exdates),
    meta:       { ...ev.meta },
    _seriesId:  ev.seriesId,
    _recurring: isRecurring,
  };
}

/** Convert an array of EngineEvents to the legacy shape. */
export function toLegacyEvents(events: EngineEvent[]): LegacyEventOut[] {
  return events.map(toLegacyEvent);
}
