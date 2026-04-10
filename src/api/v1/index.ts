/**
 * CalendarEngine — public API v1 barrel.
 *
 * Import engine types and helpers from here rather than from internal
 * engine paths.  This is the versioned stability boundary.
 *
 * @example
 *   import { makeEvent, SyncMetadata, serializeEvent } from 'works-calendar/api/v1';
 */
export * from './types.js';
export * from './serialization.js';
