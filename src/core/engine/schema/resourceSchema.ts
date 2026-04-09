/**
 * CalendarEngine — resource schema.
 *
 * A resource is anything that can be booked/assigned to an event:
 * a room, a person, a piece of equipment, etc.
 */

// ─── Resource ─────────────────────────────────────────────────────────────────

export interface EngineResource {
  readonly id: string;
  readonly name: string;
  readonly color?: string;
  /** Maximum number of simultaneous bookings (1 = exclusive, null = unlimited). */
  readonly capacity?: number | null;
  /** IANA timezone override for this resource. */
  readonly timezone?: string;
  /** Resource-specific working hours (overrides calendar-level businessHours). */
  readonly businessHours?: ResourceBusinessHours | null;
  readonly meta?: Readonly<Record<string, unknown>>;
}

export interface ResourceBusinessHours {
  /** Day indices that are working days (0=Sun … 6=Sat). */
  readonly days: readonly number[];
  /** "HH:MM" — start of working day, e.g. "09:00" */
  readonly start: string;
  /** "HH:MM" — end of working day, e.g. "17:00" */
  readonly end: string;
}
