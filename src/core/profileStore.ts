/**
 * Legacy profile store — seeds the `wc-profiles-{calendarId}` localStorage key
 * that `useSavedViews` migrates from on first load.
 */

import { safeGetLocalStorage, safeSetLocalStorage } from './safeLocalStorage';

export function saveProfiles(calendarId: string, profiles: unknown): void {
  safeSetLocalStorage(`wc-profiles-${calendarId}`, JSON.stringify(profiles));
}

export function loadProfiles(calendarId: string): unknown {
  try {
    const raw = safeGetLocalStorage(`wc-profiles-${calendarId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
