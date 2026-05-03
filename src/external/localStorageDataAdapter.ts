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

function readEvents(key: string) {
  try {
    const raw = safeGetLocalStorage(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
