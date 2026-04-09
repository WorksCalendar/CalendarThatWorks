import { useMemo } from 'react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval,
  format, isSameDay, isToday,
} from 'date-fns';
import { useCalendarContext, resolveColor } from '../core/CalendarContext.js';
import styles from './AgendaView.module.css';

export default function AgendaView({ currentDate, events, onEventClick }) {
  const ctx = useCalendarContext();

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
    if (ctx?.emptyState) return <>{ctx.emptyState}</>;
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
            {dayEvents.map(ev => {
              const color   = resolveColor(ev, ctx?.colorRules);
              const onClick = () => onEventClick?.(ev);
              const statusClass = ev.status === 'cancelled' ? styles.cancelled
                : ev.status === 'tentative' ? styles.tentative : '';

              if (ctx?.renderEvent) {
                const custom = ctx.renderEvent(ev, { view: 'agenda', isCompact: true, onClick, color });
                if (custom != null) {
                  return (
                    <div key={ev.id} className={[styles.event, statusClass].filter(Boolean).join(' ')}
                      onClick={onClick}>
                      {custom}
                    </div>
                  );
                }
              }

              return (
                <button key={ev.id} className={[styles.event, statusClass].filter(Boolean).join(' ')}
                  onClick={onClick}>
                  <span className={styles.evDot} style={{ background: color }} />
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
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
