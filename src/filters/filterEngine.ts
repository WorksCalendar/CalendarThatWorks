/**
 * filterEngine.js — schema-driven, chainable event filter.
 *
 * applyFilters(items, filters, schema) loops through the schema and applies
 * each field's filter in order. Fields with a custom predicate use it
 * directly; built-in types (text, date-range, multi-select …) fall back to
 * the shared matching helpers.
 *
 * Backward-compatible: the schema parameter defaults to DEFAULT_FILTER_SCHEMA
 * which reproduces the previous hardcoded pipeline exactly.
 */
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { DEFAULT_FILTER_SCHEMA } from './filterSchema';
import type { FilterField, FilterFieldType } from './filterSchema';
import { isEmptyFilterValue }    from './filterState';

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Filter an array of events using a filter state object and an optional schema.
 *
 * @param {object[]} items    — normalized events
 * @param {object}   filters  — { [fieldKey]: value }
 * @param [schema]
 * @returns {object[]}
 */
type FilterItem = Record<string, unknown>;
type FilterState = Record<string, unknown>;

export function applyFilters<T extends object>(
  items: T[],
  filters: FilterState = {},
  schema: readonly FilterField[] = DEFAULT_FILTER_SCHEMA,
): T[] {
  return items.filter((item: T) => {
    const itemRecord = item as Record<string, unknown>;
    return schema.every(field => {
      const value = filters[field.key];
      if (isEmptyFilterValue(value)) return true;

      // Custom predicate takes absolute priority
      if (field.predicate) return field.predicate(item, value);

      // Built-in type dispatch
      if (field.type === 'text' || field.key === 'search') {
        return _matchSearch(itemRecord, typeof value === 'string' ? value : value == null ? null : String(value));
      }
      if (field.type === 'date-range' || field.key === 'dateRange') {
        return _matchDateRange(itemRecord, value as { start?: Date; end?: Date } | null | undefined);
      }
      return _defaultMatch(itemRecord[field.key], value, field.type);
    });
  });
}

// ── Built-in matching helpers ─────────────────────────────────────────────────

function _defaultMatch(itemValue: unknown, filterValue: unknown, fieldType: FilterFieldType): boolean {
  switch (fieldType) {
    case 'multi-select': {
      const set = filterValue instanceof Set
        ? (filterValue as Set<unknown>)
        : new Set<unknown>(isIterable(filterValue) ? filterValue : []);
      return set.has(itemValue);
    }
    case 'select':
      return itemValue === filterValue;
    case 'boolean':
      return Boolean(itemValue) === Boolean(filterValue);
    case 'text':
      return String(itemValue ?? '').toLowerCase()
        .includes(String(filterValue).toLowerCase());
    default:
      return true;
  }
}

function isIterable(value: unknown): value is Iterable<unknown> {
  return value != null
    && typeof value === 'object'
    && Symbol.iterator in (value as object);
}

function _matchDateRange(item: FilterItem, range: { start?: Date; end?: Date } | null | undefined): boolean {
  if (!range) return true;
  const { start, end } = range;
  if (!start && !end) return true;
  const rangeStart = start ? startOfDay(start) : new Date(0);
  const rangeEnd   = end   ? endOfDay(end)     : new Date(8640000000000000);
  // Guard: evStart/evEnd must be valid Dates before passing to isWithinInterval.
  // Unnormalized events may have ISO strings, undefined, or null; coerce carefully:
  // null must produce NaN (new Date(null) = epoch, which is a real date and would
  // cause null-dated events to incorrectly match any filter ending after 1970-01-01).
  const rawStart = item['start'];
  const rawEnd   = item['end'] ?? item['start'];
  const evStart  = toDateOrNaN(rawStart);
  const evEnd    = toDateOrNaN(rawEnd);
  if (isNaN(evStart.getTime()) || isNaN(evEnd.getTime())) return false;
  return (
    isWithinInterval(evStart, { start: rangeStart, end: rangeEnd }) ||
    isWithinInterval(evEnd,   { start: rangeStart, end: rangeEnd }) ||
    (evStart <= rangeStart && evEnd >= rangeEnd)
  );
}

function toDateOrNaN(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value == null) return new Date(NaN);
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date(NaN);
}

function _matchSearch(item: FilterItem, query: string | null | undefined): boolean {
  if (!query || !query.trim()) return true;
  const q = query.toLowerCase();
  const title    = item['title'];
  const resource = item['resource'];
  const category = item['category'];
  if (typeof title    === 'string' && title.toLowerCase().includes(q))    return true;
  if (typeof resource === 'string' && resource.toLowerCase().includes(q)) return true;
  if (typeof category === 'string' && category.toLowerCase().includes(q)) return true;
  // Guard: meta must be a plain object; a truthy primitive (string, number)
  // would cause Object.values() to iterate characters / return empty, silently
  // excluding events that actually match the search query via their meta.
  const meta = item['meta'];
  if (meta !== null && meta !== undefined && typeof meta === 'object') {
    return Object.values(meta as Record<string, unknown>)
      .some(v => v !== null && v !== undefined && String(v).toLowerCase().includes(q));
  }
  return false;
}

// ── Option extractors ─────────────────────────────────────────────────────────

/** Extract unique sorted categories from an event list. */
export function getCategories(events: readonly object[]): string[] {
  const set = new Set<string>();
  events.forEach(e => {
    const cat = (e as Record<string, unknown>)['category'];
    if (typeof cat === 'string' && cat) set.add(cat);
  });
  return [...set].sort();
}

/** Extract unique sorted resources from an event list. */
export function getResources(events: readonly object[]): string[] {
  const set = new Set<string>();
  events.forEach(e => {
    const res = (e as Record<string, unknown>)['resource'];
    if (typeof res === 'string' && res) set.add(res);
  });
  return [...set].sort();
}

/** Extract unique { id, label } source pairs from an event list. */
export function getSources(events: readonly object[]): Array<{ id: string; label: string }> {
  const map = new Map<string, { id: string; label: string }>();
  events.forEach(e => {
    const rec = e as Record<string, unknown>;
    const id = rec['_sourceId'];
    if (typeof id === 'string' && id && !map.has(id)) {
      const label = rec['_sourceLabel'];
      map.set(id, { id, label: typeof label === 'string' ? label : id });
    }
  });
  return [...map.values()];
}
