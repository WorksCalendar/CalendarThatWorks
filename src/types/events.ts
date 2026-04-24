/**
 * Core event types — re-exported from the public API.
 *
 * `NormalizedEvent` is the internal shape produced by `useNormalizedEvents`;
 * all fields are guaranteed and all dates are `Date` instances.
 */

import type { EventVisualPriority } from './view';
import { isVisualPriority } from './view';

export type { EventVisualPriority };
export { isVisualPriority };
export type EventStatus = 'confirmed' | 'tentative' | 'cancelled';

export interface WorksCalendarEvent {
  id?: string | undefined;
  title: string;
  start: Date | string;
  end?: Date | string | undefined;
  allDay?: boolean | undefined;
  category?: string | undefined;
  color?: string | undefined;
  resource?: string | undefined;
  status?: EventStatus | undefined;
  /** Importance signal: 'muted' = normal recurring ops; 'high' = planning exceptions. */
  visualPriority?: EventVisualPriority | undefined;
  meta?: Record<string, unknown> | undefined;
  rrule?: string | undefined;
  exdates?: Array<Date | string> | undefined;
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
  /** Present when the raw event supplies visualPriority; null otherwise. */
  visualPriority?: EventVisualPriority | null | undefined;
  meta: Record<string, unknown>;
  rrule: string | null;
  exdates: Array<Date | string>;
  _raw: WorksCalendarEvent;
  _recurring?: boolean | undefined;
  _seriesId?: string | undefined;
  _feedLabel?: string | undefined;
  _col?: number | undefined;
  _numCols?: number | undefined;
}
