/**
 * Core event types — re-exported from the public API.
 *
 * `NormalizedEvent` is the internal shape produced by `useNormalizedEvents`;
 * all fields are guaranteed and all dates are `Date` instances.
 */

export type EventStatus = 'confirmed' | 'tentative' | 'cancelled';

/** Drives data-wc-priority="muted"|"high" on event pills across all views. */
export type EventVisualPriority = 'muted' | 'high';

export interface WorksCalendarEvent {
  id?: string;
  title: string;
  start: Date | string;
  end?: Date | string;
  allDay?: boolean;
  category?: string;
  color?: string;
  resource?: string;
  status?: EventStatus;
  /** Importance signal: 'muted' = normal recurring ops; 'high' = planning exceptions. */
  visualPriority?: EventVisualPriority;
  meta?: Record<string, unknown>;
  rrule?: string;
  exdates?: Array<Date | string>;
}

export interface NormalizedEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  category: string | null;
  color: string;
  resource: string | null;
  status: EventStatus;
  visualPriority: EventVisualPriority | null;
  meta: Record<string, unknown>;
  rrule: string | null;
  exdates: Array<Date | string>;
  _raw: WorksCalendarEvent;
  _recurring?: boolean;
  _seriesId?: string;
  _feedLabel?: string;
  _col?: number;
  _numCols?: number;
}
