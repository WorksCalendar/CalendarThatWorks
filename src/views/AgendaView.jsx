import { useMemo } from 'react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval,
  format, isSameDay, isToday,
} from 'date-fns';
import styles from './AgendaView.module.css';

export default function AgendaView({ currentDate, events, onEventClick }) {
  const days = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end   = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const grouped = useMemo(() => {
    return days
      .map(day => ({
        day,
        events: events
          .filter(e => isSameDay(e.start, day))
          .sort((a, b) => a.start - b.start),
      }))
      .filter(g => g.events.length > 0);
  }, [days, events]);

  if (grouped.length === 0) {
    return (
      <div className={styles.empty}>
        No events in {format(currentDate, 'MMMM yyyy')}
      </div>
    );
  }

  return (
    <div className={styles.agenda}>
      {grouped.map(({ day, events: dayEvents }) => (
        <div key={format(day, 'yyyy-MM-dd')} className={styles.group}>
          <div className={[styles.dateHead, isToday(day) && styles.today].filter(Boolean).join(' ')}>
            <span className={styles.dayName}>{format(day, 'EEE')}</span>
            <span className={styles.dayNum}>{format(day, 'd')}</span>
            <span className={styles.monthLabel}>{format(day, 'MMM yyyy')}</span>
          </div>
          <div className={styles.events}>
            {dayEvents.map(ev => (
              <button key={ev.id} className={styles.event} onClick={() => onEventClick?.(ev)}>
                <span className={styles.evDot} style={{ background: ev.color }} />
                <div className={styles.evBody}>
                  <span className={styles.evTitle}>{ev.title}</span>
                  <div className={styles.evMeta}>
                    {!ev.allDay && (
                      <span>{format(ev.start, 'h:mm a')} – {format(ev.end, 'h:mm a')}</span>
                    )}
                    {ev.allDay && <span>All day</span>}
                    {ev.category && <span className={styles.cat}>{ev.category}</span>}
                    {ev.resource && <span>{ev.resource}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
