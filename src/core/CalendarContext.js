/**
 * CalendarContext — shared context threaded through all views.
 * Avoids prop-drilling renderEvent, colorRules, businessHours, etc.
 */
import { createContext, useContext } from 'react';

export const CalendarContext = createContext(null);

export function useCalendarContext() {
  return useContext(CalendarContext);
}

/**
 * Apply colorRules to a normalized event.
 * Rules are checked in order; first match wins.
 * Falls back to ev.color if no rule matches or colorRules is empty.
 */
export function resolveColor(ev, colorRules) {
  if (colorRules?.length) {
    for (const rule of colorRules) {
      try {
        if (rule.when(ev)) return rule.color;
      } catch (_) { /* ignore rule errors */ }
    }
  }
  return ev.color;
}
