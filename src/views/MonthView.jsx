import { useMemo, useState } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  format, getISOWeek,
} from 'date-fns';
import { useCalendarContext, resolveColor } from '../core/CalendarContext.js';
import styles from './MonthView.module.css';

const MAX_VISIBLE = 3;

export default function MonthView({ currentDate, events, onEventClick, onDayClick, config, weekStartDay = 0 }) {
  const [popoverDay, setPopoverDay] = useState(null);
  const ctx = useCalendarContext();

  const { weeks, dayNames } = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd   = endOfMonth(currentDate);
    const gridStart  = startOfWeek(monthStart, { weekStartsOn: weekStartDay });
    const gridEnd    = endOfWeek(monthEnd,     { weekStartsOn: weekStartDay });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

    const wks = [];
    for (let i = 0; i < days.length; i += 7) wks.push(days.slice(i, i + 7));
    const names = [];
    for (let i = 0; i < 7; i++) names.push(format(days[i], 'EEE'));
    return { weeks: wks, dayNames: names };
  }, [currentDate, weekStartDay]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    events.forEach(ev => {
      const key = format(ev.start, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    });
    return map;
  }, [events]);

  const showWeekNumbers = config?.display?.showWeekNumbers;

  function renderPill(ev, inPopover = false) {
    const color   = resolveColor(ev, ctx?.colorRules);
    const onClick = () => { onEventClick?.(ev); if (inPopover) setPopoverDay(null); };

    const statusClass = ev.status === 'cancelled'
      ? styles.cancelled
      : ev.status === 'tentative'
      ? styles.tentative
      : '';

    if (ctx?.renderEvent) {
      const custom = ctx.renderEvent(ev, { view: 'month', isCompact: true, onClick, color });
      if (custom != null) {
        return (
          <div
            key={ev.id}
            className={[styles.eventPill, statusClass].filter(Boolean).join(' ')}
            onClick={e => { e.stopPropagation(); onClick(); }}
          >
            {custom}
          </div>
        );
      }
    }

    return (
      <button
        key={ev.id}
        className={[styles.eventPill, statusClass].filter(Boolean).join(' ')}
        style={{ '--ev-color': color }}
        onClick={e => { e.stopPropagation(); onClick(); }}
        title={ev.title}
      >
        {ev.title}
      </button>
    );
  }

  return (
    <div className={styles.month}>
      <div className={styles.header} style={{ gridTemplateColumns: showWeekNumbers ? `32px repeat(7, 1fr)` : `repeat(7, 1fr)` }}>
        {showWeekNumbers && <div className={styles.weekNumHead} />}
        {dayNames.map(n => <div key={n} className={styles.dayName}>{n}</div>)}
      </div>

      <div className={styles.grid}>
        {weeks.map((week, wi) => (
          <div key={wi} className={styles.week}>
            {showWeekNumbers && (
              <div className={styles.weekNum}>{getISOWeek(week[0])}</div>
            )}
            {week.map(day => {
              const key = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDay.get(key) || [];
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isPopoverOpen  = popoverDay && isSameDay(popoverDay, day);

              return (
                <div
                  key={key}
                  className={[
                    styles.cell,
                    !isCurrentMonth && styles.otherMonth,
                    isToday(day) && styles.today,
                  ].filter(Boolean).join(' ')}
                  onClick={() => onDayClick?.(day)}
                >
                  <span className={styles.dayNum}>{format(day, 'd')}</span>

                  <div className={styles.events}>
                    {dayEvents.slice(0, MAX_VISIBLE).map(ev => renderPill(ev))}
                    {dayEvents.length > MAX_VISIBLE && (
                      <button
                        className={styles.morePill}
                        onClick={e => { e.stopPropagation(); setPopoverDay(isPopoverOpen ? null : day); }}
                      >
                        +{dayEvents.length - MAX_VISIBLE} more
                      </button>
                    )}
                  </div>

                  {isPopoverOpen && (
                    <div className={styles.popover} onClick={e => e.stopPropagation()}>
                      <div className={styles.popoverHead}>
                        <span>{format(day, 'MMMM d')}</span>
                        <button onClick={() => setPopoverDay(null)}>×</button>
                      </div>
                      {dayEvents.map(ev => renderPill(ev, true))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
