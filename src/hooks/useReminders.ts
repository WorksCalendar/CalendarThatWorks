import { useEffect, useRef } from 'react';
import type { NormalizedEvent, ReminderDef, WorksCalendarEvent } from '../types/events';

export type ReminderCallback = (event: WorksCalendarEvent, reminder: ReminderDef) => void;

/**
 * Schedule browser or callback reminders for all visible events that carry
 * a `reminders` array.
 *
 * For 'browser' reminders, calls Notification.requestPermission() once and
 * then fires a Web Notification at the configured offset. For 'callback'
 * reminders, invokes onReminder instead.
 *
 * Timers are re-registered whenever the events array changes and are all
 * cleared on unmount.
 */
export function useReminders(
  events: NormalizedEvent[],
  onReminder?: ReminderCallback,
): void {
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const permissionRequestedRef = useRef(false);

  useEffect(() => {
    // Clear all previously registered timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const now = Date.now();

    for (const ev of events) {
      if (!ev.reminders || ev.reminders.length === 0) continue;
      if (ev.allDay) continue; // all-day events have no meaningful fire time

      for (const reminder of ev.reminders) {
        const fireAt = ev.start.getTime() - reminder.minutesBefore * 60_000;
        const delay = fireAt - now;

        // Skip reminders that have already passed (or are < 1 s away to avoid
        // immediate spam on page load when an event just started).
        if (delay < 1_000) continue;

        const timer = setTimeout(() => {
          if (reminder.method === 'browser') {
            fireBrowserNotification(ev, reminder);
          } else {
            onReminder?.(ev._raw, reminder);
          }
        }, delay);

        timersRef.current.push(timer);
      }
    }

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [events, onReminder]);

  // Request permission once when any browser reminder is registered
  useEffect(() => {
    if (permissionRequestedRef.current) return;
    const hasBrowser = events.some(ev =>
      ev.reminders?.some(r => r.method === 'browser'),
    );
    if (!hasBrowser) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      permissionRequestedRef.current = true;
      Notification.requestPermission().catch(() => { /* user dismissed */ });
    }
  }, [events]);
}

function fireBrowserNotification(ev: NormalizedEvent, reminder: ReminderDef): void {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  const label = reminder.minutesBefore === 0
    ? 'Now'
    : reminder.minutesBefore < 60
      ? `in ${reminder.minutesBefore} min`
      : `in ${reminder.minutesBefore / 60} hr`;

  new Notification(ev.title, {
    body: `Starts ${label}`,
    tag:  `wc-reminder-${ev.id}-${reminder.minutesBefore}`,
  });
}
