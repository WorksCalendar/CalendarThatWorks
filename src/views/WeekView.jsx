import { useMemo } from 'react';
import {
  startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameDay, isToday, getHours, getMinutes, differenceInMinutes,
} from 'date-fns';
import { useCalendarContext, resolveColor } from '../core/CalendarContext.js';
import styles from './WeekView.module.css';

export default function WeekView({ currentDate, events, onEventClick, config, weekStartDay = 0 }) {
  const ctx = useCalendarContext();
  const dayStart   = config?.display?.dayStart ?? 6;
  const dayEnd     = config?.display?.dayEnd   ?? 22;
  const totalHours = dayEnd - dayStart;
  const pxPerHour  = 64;

  const bizHours = ctx?.businessHours ?? null;

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

  function isBizHour(h, day) {
    if (!bizHours) return true;
    const bizDays = bizHours.days ?? [1, 2, 3, 4, 5];
    return bizDays.includes(day.getDay()) && h >= bizHours.start && h < bizHours.end;
  }

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

  function renderEvent(ev) {
    const color   = resolveColor(ev, ctx?.colorRules);
    const onClick = () => onEventClick?.(ev);
    const { top, height } = eventPosition(ev);

    const statusClass = ev.status === 'cancelled' ? styles.cancelled
      : ev.status === 'tentative' ? styles.tentative : '';

    if (ctx?.renderEvent) {
      const custom = ctx.renderEvent(ev, { view: 'week', isCompact: false, onClick, color });
      if (custom != null) {
        return (
          <div
            key={ev.id}
            className={[styles.event, statusClass].filter(Boolean).join(' ')}
            style={{ top, height, '--ev-color': color }}
          >
            {custom}
          </div>
        );
      }
    }

    return (
      <button
        key={ev.id}
        className={[styles.event, statusClass].filter(Boolean).join(' ')}
        style={{ top, height, '--ev-color': color }}
        onClick={onClick}
      >
        <span className={styles.evTitle}>{ev.title}</span>
        <span className={styles.evTime}>{format(ev.start, 'h:mm a')}</span>
      </button>
    );
  }

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
                {dayAD.map(ev => {
                  const color = resolveColor(ev, ctx?.colorRules);
                  return (
                    <button key={ev.id} className={styles.allDayPill}
                      style={{ '--ev-color': color }}
                      onClick={() => onEventClick?.(ev)}>
                      {ev.title}
                    </button>
                  );
                })}
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
            <div key={key}
              className={[styles.dayCol, isToday(day) && styles.todayCol].filter(Boolean).join(' ')}
              style={{ height: totalHours * pxPerHour }}
            >
              {/* Hour lines + business-hours shading */}
              {hours.map(h => (
                <div
                  key={h}
                  className={[
                    styles.hourLine,
                    bizHours && !isBizHour(h, day) && styles.offHour,
                  ].filter(Boolean).join(' ')}
                  style={{ top: (h - dayStart) * pxPerHour, height: pxPerHour }}
                />
              ))}

              {/* Now line */}
              {isNowDay && showNowLine && (
                <div className={styles.nowLine} style={{ top: nowTop }}>
                  <div className={styles.nowDot} />
                </div>
              )}

              {dayEvents.map(ev => renderEvent(ev))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
