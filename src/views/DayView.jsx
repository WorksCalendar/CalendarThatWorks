import {
  format, isToday, isSameDay, getHours, getMinutes, differenceInMinutes,
} from 'date-fns';
import { useCalendarContext, resolveColor } from '../core/CalendarContext.js';
import styles from './DayView.module.css';

export default function DayView({ currentDate, events, onEventClick, config }) {
  const ctx = useCalendarContext();
  const dayStart  = config?.display?.dayStart ?? 6;
  const dayEnd    = config?.display?.dayEnd   ?? 22;
  const pxPerHour = 64;
  const bizHours  = ctx?.businessHours ?? null;

  const hours = [];
  for (let h = dayStart; h <= dayEnd; h++) hours.push(h);

  const dayEvents = events.filter(e => isSameDay(e.start, currentDate) && !e.allDay);
  const allDayEvs = events.filter(e => isSameDay(e.start, currentDate) && e.allDay);

  const now = new Date();
  const nowTop = ((getHours(now) - dayStart) * 60 + getMinutes(now)) / 60 * pxPerHour;
  const showNow = isToday(currentDate) && getHours(now) >= dayStart && getHours(now) < dayEnd;

  function eventPosition(ev) {
    const startMin = (getHours(ev.start) - dayStart) * 60 + getMinutes(ev.start);
    const endMin   = (getHours(ev.end)   - dayStart) * 60 + getMinutes(ev.end);
    return {
      top:    Math.max(0, startMin) / 60 * pxPerHour,
      height: Math.max(20, endMin - startMin) / 60 * pxPerHour,
    };
  }

  function isBizHour(h) {
    if (!bizHours) return true;
    const bizDays = bizHours.days ?? [1, 2, 3, 4, 5];
    return bizDays.includes(currentDate.getDay()) && h >= bizHours.start && h < bizHours.end;
  }

  function renderEvent(ev) {
    const color   = resolveColor(ev, ctx?.colorRules);
    const onClick = () => onEventClick?.(ev);
    const { top, height } = eventPosition(ev);
    const statusClass = ev.status === 'cancelled' ? styles.cancelled
      : ev.status === 'tentative' ? styles.tentative : '';

    if (ctx?.renderEvent) {
      const custom = ctx.renderEvent(ev, { view: 'day', isCompact: false, onClick, color });
      if (custom != null) {
        return (
          <div key={ev.id} className={[styles.event, statusClass].filter(Boolean).join(' ')}
            style={{ top, height, '--ev-color': color }}>
            {custom}
          </div>
        );
      }
    }

    return (
      <button key={ev.id} className={[styles.event, statusClass].filter(Boolean).join(' ')}
        style={{ top, height, '--ev-color': color }}
        onClick={onClick}>
        <span className={styles.evTitle}>{ev.title}</span>
        <span className={styles.evTime}>{format(ev.start, 'h:mm a')} – {format(ev.end, 'h:mm a')}</span>
        {ev.resource && <span className={styles.evMeta}>{ev.resource}</span>}
      </button>
    );
  }

  return (
    <div className={styles.day}>
      <div className={styles.dayHeader}>
        <span className={[styles.dayNum, isToday(currentDate) && styles.today].filter(Boolean).join(' ')}>
          {format(currentDate, 'EEEE, MMMM d')}
        </span>
      </div>

      {allDayEvs.length > 0 && (
        <div className={styles.allDayRow}>
          <div className={styles.timeLabel}>all‑day</div>
          <div className={styles.allDayEvents}>
            {allDayEvs.map(ev => {
              const color = resolveColor(ev, ctx?.colorRules);
              return (
                <button key={ev.id} className={styles.allDayPill} style={{ '--ev-color': color }}
                  onClick={() => onEventClick?.(ev)}>{ev.title}</button>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.grid}>
        <div className={styles.timeCol}>
          {hours.map(h => (
            <div key={h} className={styles.hourLabel} style={{ height: pxPerHour }}>
              {h === dayStart ? '' : format(new Date().setHours(h, 0, 0, 0), 'h a')}
            </div>
          ))}
        </div>
        <div className={styles.eventCol} style={{ height: (dayEnd - dayStart) * pxPerHour }}>
          {hours.map(h => (
            <div
              key={h}
              className={[
                styles.hourLine,
                bizHours && !isBizHour(h) && styles.offHour,
              ].filter(Boolean).join(' ')}
              style={{ top: (h - dayStart) * pxPerHour, height: pxPerHour }}
            />
          ))}

          {showNow && (
            <div className={styles.nowLine} style={{ top: nowTop }}>
              <div className={styles.nowDot} />
            </div>
          )}

          {dayEvents.map(ev => renderEvent(ev))}
        </div>
      </div>
    </div>
  );
}
