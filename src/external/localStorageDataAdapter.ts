/**
 * localStorage adapter used by CalendarExternalForm examples and smoke tests.
 */
import { safeGetLocalStorage, safeSetLocalStorage } from '../core/safeLocalStorage';
export function createLocalStorageDataAdapter({ key = 'works-calendar:external-events' } = {}) {
  return {
    async submitEvent(payload: Record<string, unknown>) {
      const events = readEvents(key);
      const record = {
        id: `ext-${Date.now().toString(36)}`,
        createdAt: new Date().toISOString(),
        ...payload,
      };
      const next = [...events, record];
      safeSetLocalStorage(key, JSON.stringify(next));
      return record;
    },
  };
}

function readEvents(key: string): Record<string, unknown>[] {
  try {
    const raw = safeGetLocalStorage(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Record<string, unknown>[];
  } catch (err) {
    // Warn so developers notice localStorage corruption. Returning [] here is
    // intentionally conservative — we do NOT write over the corrupted entry
    // just because we couldn't parse it; the next submitEvent call will still
    // attempt to write (which is correct), but at least the loss is surfaced.
    console.warn('[works-calendar] localStorageDataAdapter: could not parse stored events; treating as empty.', err);
    return [];
  }
}
