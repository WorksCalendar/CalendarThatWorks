import { useMemo } from 'react';
import {
  startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameDay, isToday, getHours, getMinutes, differenceInMinutes,
  startOfDay, max, min,
} from 'date-fns';
import styles from './WeekView.module.css';

export default function WeekView({ currentDate, events, onEventClick, config, weekStartDay = 0 }) {
  const dayStart = config?.display?.dayStart ?? 6;
  const dayEnd   = config?.display?.dayEnd   ?? 22;
  const totalHours = dayEnd - dayStart;
  const pxPerHour = 64;

  const days = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: weekStartDay });
    const end   = endOfWeek(currentDate,   { weekStartsOn: weekStartDay });
    return eachDayOfInterval({ start, end });
  }, [currentDate, weekStartDay]);

  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay = [];
    const timed  = [];
    events.forEach(ev => {
      if (ev.allDay || differenceInMinutes(ev.end, ev.start) >= 1440) allDay.push(ev);
      else timed.push(ev);
    });
    return { allDayEvents: allDay, timedEvents: timed };
  }, [events]);

  const hours = [];
  for (let h = dayStart; h <= dayEnd; h++) hours.push(h);

  function eventPosition(ev) {
    const startMin = (getHours(ev.start) - dayStart) * 60 + getMinutes(ev.start);
    const endMin   = (getHours(ev.end)   - dayStart) * 60 + getMinutes(ev.end);
    const top    = Math.max(0, startMin) / 60 * pxPerHour;
    const height = Math.max(20, (endMin - startMin)) / 60 * pxPerHour;
    return { top, height };
  }

  const now = new Date();
  const nowTop = ((getHours(now) - dayStart) * 60 + getMinutes(now)) / 60 * pxPerHour;
  const showNowLine = getHours(now) >= dayStart && getHours(now) < dayEnd;

  return (
    <div className={styles.week}>
      {/* Header row */}
      <div className={styles.headerRow}>
        <div className={styles.timeGutter} />
        {days.map(day => (
          <div key={format(day, 'yyyy-MM-dd')} className={[styles.dayHead, isToday(day) && styles.todayHead].filter(Boolean).join(' ')}>
            <span className={styles.dayAbbr}>{format(day, 'EEE')}</span>
            <span className={[styles.dayNum, isToday(day) && styles.todayNum].filter(Boolean).join(' ')}>
              {format(day, 'd')}
            </span>
          </div>
        ))}
      </div>

      {/* All-day row */}
      {allDayEvents.length > 0 && (
        <div className={styles.allDayRow}>
          <div className={styles.timeGutter}><span>all‑day</span></div>
          {days.map(day => {
            const key = format(day, 'yyyy-MM-dd');
            const dayAD = allDayEvents.filter(e => isSameDay(e.start, day));
            return (
              <div key={key} className={styles.allDayCell}>
                {dayAD.map(ev => (
                  <button key={ev.id} className={styles.allDayPill} style={{ '--ev-color': ev.color }}
                    onClick={() => onEventClick?.(ev)}>{ev.title}</button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Time grid */}
      <div className={styles.grid}>
        <div className={styles.timeCol}>
          {hours.map(h => (
            <div key={h} className={styles.hourLabel} style={{ height: pxPerHour }}>
              {h === dayStart ? '' : format(new Date().setHours(h, 0, 0, 0), 'h a')}
            </div>
          ))}
        </div>

        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const dayEvents = timedEvents.filter(e => isSameDay(e.start, day));
          const isNowDay  = isToday(day);

          return (
            <div key={key} className={[styles.dayCol, isToday(day) && styles.todayCol].filter(Boolean).join(' ')}
              style={{ height: totalHours * pxPerHour }}>

              {/* Hour lines */}
              {hours.map(h => (
                <div key={h} className={styles.hourLine} style={{ top: (h - dayStart) * pxPerHour }} />
              ))}

              {/* Current time indicator */}
              {isNowDay && showNowLine && (
                <div className={styles.nowLine} style={{ top: nowTop }}>
                  <div className={styles.nowDot} />
                </div>
              )}

              {/* Events */}
              {dayEvents.map(ev => {
                const { top, height } = eventPosition(ev);
                return (
                  <button
                    key={ev.id}
                    className={styles.event}
                    style={{ top, height, '--ev-color': ev.color }}
                    onClick={() => onEventClick?.(ev)}
                  >
                    <span className={styles.evTitle}>{ev.title}</span>
                    <span className={styles.evTime}>{format(ev.start, 'h:mm a')}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
