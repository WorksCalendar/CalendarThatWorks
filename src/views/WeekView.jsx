import { useMemo } from 'react';
import {
  startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameDay, isToday,
  getHours, getMinutes,
  startOfDay, differenceInCalendarDays, addDays,
} from 'date-fns';
import { useCalendarContext, resolveColor } from '../core/CalendarContext.js';
import { layoutOverlaps, layoutSpans } from '../core/layout.js';
import styles from './WeekView.module.css';

const SPAN_H   = 22;
const SPAN_GAP = 2;
const MAX_SPANS = 4; // max visible all-day span lanes before "+N more"

/** Does this event span more than one calendar day? */
function isMultiDay(ev) {
  return ev.allDay || !isSameDay(ev.start, ev.end);
}

export default function WeekView({ currentDate, events, onEventClick, config, weekStartDay = 0 }) {
  const ctx = useCalendarContext();
  const dayStart   = config?.display?.dayStart ?? 6;
  const dayEnd     = config?.display?.dayEnd   ?? 22;
  const totalHours = dayEnd - dayStart;
  const pxPerHour  = 64;
  const bizHours   = ctx?.businessHours ?? null;

  const days = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: weekStartDay });
    const end   = endOfWeek(currentDate,   { weekStartsOn: weekStartDay });
    return eachDayOfInterval({ start, end });
  }, [currentDate, weekStartDay]);

  const weekStart = days[0];
  const weekEnd   = days[6];

  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay = [];
    const timed  = [];
    events.forEach(ev => (isMultiDay(ev) ? allDay : timed).push(ev));
    return { allDayEvents: allDay, timedEvents: timed };
  }, [events]);

  // Lane-pack all-day / multi-day events across the week
  const allDaySpans = useMemo(
    () => layoutSpans(allDayEvents, weekStart, weekEnd),
    [allDayEvents, weekStart, weekEnd],
  );
  const allDayLanes   = allDaySpans.length ? Math.max(...allDaySpans.map(s => s.lane)) + 1 : 0;
  const allDayVisible = Math.min(allDayLanes, MAX_SPANS);
  const allDayHeight  = allDayVisible * (SPAN_H + SPAN_GAP);

  // Column-pack timed events per day to avoid overlap
  const timedByDay = useMemo(() => {
    const map = new Map();
    days.forEach(day => {
      const key  = format(day, 'yyyy-MM-dd');
      const dayEvs = timedEvents.filter(e => isSameDay(e.start, day));
      map.set(key, layoutOverlaps(dayEvs));
    });
    return map;
  }, [days, timedEvents]);

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
    return {
      top:    Math.max(0, startMin) / 60 * pxPerHour,
      height: Math.max(22, (endMin - startMin)) / 60 * pxPerHour,
    };
  }

  const now = new Date();
  const nowTop = ((getHours(now) - dayStart) * 60 + getMinutes(now)) / 60 * pxPerHour;
  const showNowLine = getHours(now) >= dayStart && getHours(now) < dayEnd;

  function renderTimedEvent(ev) {
    const color   = resolveColor(ev, ctx?.colorRules);
    const onClick = () => onEventClick?.(ev);
    const { top, height } = eventPosition(ev);
    // _col and _numCols from layoutOverlaps
    const numCols = ev._numCols ?? 1;
    const col     = ev._col     ?? 0;
    const pctLeft  = (col / numCols) * 100;
    const pctWidth = (1 / numCols) * 100;
    const statusClass = ev.status === 'cancelled' ? styles.cancelled
      : ev.status === 'tentative' ? styles.tentative : '';

    if (ctx?.renderEvent) {
      const custom = ctx.renderEvent(ev, { view: 'week', isCompact: false, onClick, color });
      if (custom != null) {
        return (
          <div key={ev.id} className={[styles.event, statusClass].filter(Boolean).join(' ')}
            style={{ top, height, '--ev-color': color, left: `${pctLeft}%`, width: `${pctWidth}%` }}>
            {custom}
          </div>
        );
      }
    }

    return (
      <button key={ev.id} className={[styles.event, statusClass].filter(Boolean).join(' ')}
        style={{ top, height, '--ev-color': color, left: `${pctLeft}%`, width: `${pctWidth}%` }}
        onClick={onClick}>
        <span className={styles.evTitle}>{ev.title}</span>
        <span className={styles.evTime}>{format(ev.start, 'h:mm a')}</span>
      </button>
    );
  }

  return (
    <div className={styles.week}>
      {/* ── Header row ── */}
      <div className={styles.headerRow}>
        <div className={styles.timeGutter} />
        {days.map(day => (
          <div key={format(day, 'yyyy-MM-dd')}
            className={[styles.dayHead, isToday(day) && styles.todayHead].filter(Boolean).join(' ')}>
            <span className={styles.dayAbbr}>{format(day, 'EEE')}</span>
            <span className={[styles.dayNum, isToday(day) && styles.todayNum].filter(Boolean).join(' ')}>
              {format(day, 'd')}
            </span>
          </div>
        ))}
      </div>

      {/* ── All-day / multi-day row ── */}
      {allDayLanes > 0 && (
        <div className={styles.allDayRow}>
          <div className={styles.timeGutter}><span>all‑day</span></div>
          <div className={styles.allDayGrid} style={{ height: allDayHeight }}>
            {allDaySpans
              .filter(s => s.lane < MAX_SPANS)
              .map(({ ev, startCol, endCol, lane, continuesBefore, continuesAfter }) => {
                const color = resolveColor(ev, ctx?.colorRules);
                const pctLeft  = (startCol / 7) * 100;
                const pctWidth = ((endCol - startCol + 1) / 7) * 100;
                const statusClass = ev.status === 'cancelled' ? styles.cancelled
                  : ev.status === 'tentative' ? styles.tentative : '';
                return (
                  <button key={ev.id}
                    className={[
                      styles.allDaySpan,
                      continuesBefore && styles.continuesBefore,
                      continuesAfter  && styles.continuesAfter,
                      statusClass,
                    ].filter(Boolean).join(' ')}
                    style={{
                      '--ev-color': color,
                      left:   `${pctLeft}%`,
                      width:  `${pctWidth}%`,
                      top:    lane * (SPAN_H + SPAN_GAP),
                      height: SPAN_H,
                    }}
                    onClick={() => onEventClick?.(ev)}
                    title={ev.title}
                  >
                    {!continuesBefore && ev.title}
                  </button>
                );
              })}
            {allDayLanes > MAX_SPANS && (
              <span className={styles.allDayMore}>
                +{allDayLanes - MAX_SPANS} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Time grid ── */}
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
          const dayEvs = timedByDay.get(key) || [];

          return (
            <div key={key}
              className={[styles.dayCol, isToday(day) && styles.todayCol].filter(Boolean).join(' ')}
              style={{ height: totalHours * pxPerHour }}
            >
              {/* Hour grid lines + business-hours shading */}
              {hours.map(h => (
                <div key={h}
                  className={[
                    styles.hourLine,
                    bizHours && !isBizHour(h, day) && styles.offHour,
                  ].filter(Boolean).join(' ')}
                  style={{ top: (h - dayStart) * pxPerHour, height: pxPerHour }}
                />
              ))}

              {/* Current time indicator */}
              {isToday(day) && showNowLine && (
                <div className={styles.nowLine} style={{ top: nowTop }}>
                  <div className={styles.nowDot} />
                </div>
              )}

              {dayEvs.map(ev => renderTimedEvent(ev))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
