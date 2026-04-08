/**
 * ScheduleView — 6-week rolling grid (great for maintenance planning).
 * Columns = resources, Rows = days, Cells = events for that resource/day.
 */
import { useMemo } from 'react';
import {
  startOfWeek, addDays, eachDayOfInterval, format,
  isSameDay, isToday,
} from 'date-fns';
import styles from './ScheduleView.module.css';

const WEEKS = 6;

export default function ScheduleView({ currentDate, events, onEventClick, weekStartDay = 0 }) {
  const resources = useMemo(() => {
    const set = new Set();
    events.forEach(e => { if (e.resource) set.add(e.resource); });
    return [...set].sort();
  }, [events]);

  const days = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: weekStartDay });
    const end   = addDays(start, WEEKS * 7 - 1);
    return eachDayOfInterval({ start, end });
  }, [currentDate, weekStartDay]);

  // If no resources, fall back to a simple date list
  if (resources.length === 0) {
    return (
      <div className={styles.fallback}>
        <p className={styles.hint}>Schedule view groups events by resource. Add a <code>resource</code> field to your events.</p>
        <div className={styles.simpleList}>
          {events.slice(0, 40).map(ev => (
            <button key={ev.id} className={styles.simpleEvent} onClick={() => onEventClick?.(ev)}
              style={{ '--ev-color': ev.color }}>
              <span>{format(ev.start, 'MMM d')}</span>
              <span>{ev.title}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.schedule}>
      {/* Header */}
      <div className={styles.header} style={{ gridTemplateColumns: `120px repeat(${resources.length}, minmax(100px, 1fr))` }}>
        <div className={styles.cornerCell} />
        {resources.map(r => (
          <div key={r} className={styles.resourceHead}>{r}</div>
        ))}
      </div>

      {/* Body */}
      <div className={styles.body}>
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          // Show week separator
          const dayOfWeek = day.getDay();
          const isWeekStart = dayOfWeek === weekStartDay;

          return (
            <div key={key}
              className={[styles.row, isWeekStart && styles.weekStart, isToday(day) && styles.todayRow].filter(Boolean).join(' ')}
              style={{ gridTemplateColumns: `120px repeat(${resources.length}, minmax(100px, 1fr))` }}
            >
              <div className={[styles.dateCell, isToday(day) && styles.todayDate].filter(Boolean).join(' ')}>
                <span className={styles.weekDay}>{format(day, 'EEE')}</span>
                <span className={styles.dayNum}>{format(day, 'MMM d')}</span>
              </div>
              {resources.map(res => {
                const cellEvents = events.filter(e => e.resource === res && isSameDay(e.start, day));
                return (
                  <div key={res} className={styles.cell}>
                    {cellEvents.map(ev => (
                      <button key={ev.id} className={styles.eventPill}
                        style={{ '--ev-color': ev.color }}
                        onClick={() => onEventClick?.(ev)}
                        title={ev.title}
                      >
                        {ev.title}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
