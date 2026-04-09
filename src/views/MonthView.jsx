import { useMemo, useState } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  format, getISOWeek, startOfDay, addDays, differenceInCalendarDays,
} from 'date-fns';
import { useCalendarContext, resolveColor } from '../core/CalendarContext.js';
import { layoutSpans } from '../core/layout.js';
import styles from './MonthView.module.css';

const SPAN_H   = 22; // px — height of a spanning event bar
const SPAN_GAP = 3;  // px — gap between span lanes
const MAX_SPANS_VISIBLE = 3; // max spanning lanes to render (rest collapse to "+N more")

/** Is this event multi-day (spans more than one calendar day)? */
function isMultiDay(ev) {
  return ev.allDay || !isSameDay(ev.start, ev.end);
}

export default function MonthView({ currentDate, events, onEventClick, onDayClick, config, weekStartDay = 0 }) {
  const [popoverDay, setPopoverDay] = useState(null);
  const ctx = useCalendarContext();

  const { weeks, dayNames } = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd   = endOfMonth(currentDate);
    const gridStart  = startOfWeek(monthStart, { weekStartsOn: weekStartDay });
    const gridEnd    = endOfWeek(monthEnd,     { weekStartsOn: weekStartDay });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const wks  = [];
    for (let i = 0; i < days.length; i += 7) wks.push(days.slice(i, i + 7));
    const names = [];
    for (let i = 0; i < 7; i++) names.push(format(days[i], 'EEE'));
    return { weeks: wks, dayNames: names };
  }, [currentDate, weekStartDay]);

  // Separate multi-day from single-day events
  const { multiDay, singleDay } = useMemo(() => {
    const multi = [];
    const single = [];
    events.forEach(ev => (isMultiDay(ev) ? multi : single).push(ev));
    return { multiDay: multi, singleDay: single };
  }, [events]);

  // Per-day buckets for single-day events
  const singleByDay = useMemo(() => {
    const map = new Map();
    singleDay.forEach(ev => {
      const key = format(ev.start, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    });
    return map;
  }, [singleDay]);

  const showWeekNumbers = config?.display?.showWeekNumbers;

  function renderPill(ev, extra = {}) {
    const color   = resolveColor(ev, ctx?.colorRules);
    const onClick = () => { onEventClick?.(ev); extra.onAfterClick?.(); };
    const statusClass = ev.status === 'cancelled' ? styles.cancelled
      : ev.status === 'tentative' ? styles.tentative : '';

    if (ctx?.renderEvent) {
      const custom = ctx.renderEvent(ev, { view: 'month', isCompact: true, onClick, color });
      if (custom != null) {
        return (
          <div key={ev.id} className={[styles.eventPill, statusClass].filter(Boolean).join(' ')}
            onClick={e => { e.stopPropagation(); onClick(); }}>
            {custom}
          </div>
        );
      }
    }

    return (
      <button key={ev.id}
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
      {/* Day name header */}
      <div className={styles.header}
        style={{ gridTemplateColumns: showWeekNumbers ? `32px repeat(7, 1fr)` : `repeat(7, 1fr)` }}>
        {showWeekNumbers && <div className={styles.weekNumHead} />}
        {dayNames.map(n => <div key={n} className={styles.dayName}>{n}</div>)}
      </div>

      <div className={styles.grid}>
        {weeks.map((week, wi) => {
          const weekStart = week[0];
          const weekEnd   = week[6];

          // Compute spanning bars for this week row
          const spans = layoutSpans(multiDay, weekStart, weekEnd);
          const laneCount = spans.length ? Math.max(...spans.map(s => s.lane)) + 1 : 0;
          const spansHeight = Math.min(laneCount, MAX_SPANS_VISIBLE) * (SPAN_H + SPAN_GAP);

          return (
            <div key={wi} className={styles.weekRow}>
              {showWeekNumbers && (
                <div className={styles.weekNum}>{getISOWeek(week[0])}</div>
              )}

              {/* Days area: spans layer + 7 cells */}
              <div className={styles.daysArea}>
                {/* ── Spanning event bars ── */}
                {laneCount > 0 && (
                  <div className={styles.spansLayer} style={{ height: spansHeight }}>
                    {spans
                      .filter(s => s.lane < MAX_SPANS_VISIBLE)
                      .map(({ ev, startCol, endCol, lane, continuesBefore, continuesAfter }) => {
                        const color = resolveColor(ev, ctx?.colorRules);
                        const pctLeft  = (startCol / 7) * 100;
                        const pctWidth = ((endCol - startCol + 1) / 7) * 100;
                        const statusClass = ev.status === 'cancelled' ? styles.cancelled
                          : ev.status === 'tentative' ? styles.tentative : '';

                        return (
                          <button
                            key={`${ev.id}-w${wi}`}
                            className={[
                              styles.spanBar,
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
                            onClick={e => { e.stopPropagation(); onEventClick?.(ev); }}
                            title={ev.title}
                          >
                            {!continuesBefore && ev.title}
                          </button>
                        );
                      })}
                  </div>
                )}

                {/* ── Day cells ── */}
                <div className={styles.weekCells} style={{ paddingTop: spansHeight }}>
                  {week.map((day, di) => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const daySingles = singleByDay.get(dayKey) || [];

                    // Count hidden overflow from spanning bars
                    const spansOnDay    = spans.filter(s => s.startCol <= di && s.endCol >= di);
                    const hiddenSpans   = spansOnDay.filter(s => s.lane >= MAX_SPANS_VISIBLE).length;
                    const visibleSpLanes = spansOnDay.filter(s => s.lane < MAX_SPANS_VISIBLE).length;
                    const MAX_PILLS = Math.max(0, 3 - visibleSpLanes);
                    const overflowCount = hiddenSpans + Math.max(0, daySingles.length - MAX_PILLS);
                    const isPopoverOpen = popoverDay && isSameDay(popoverDay, day);

                    return (
                      <div
                        key={dayKey}
                        className={[
                          styles.cell,
                          !isSameMonth(day, currentDate) && styles.otherMonth,
                          isToday(day) && styles.today,
                        ].filter(Boolean).join(' ')}
                        onClick={() => onDayClick?.(day)}
                      >
                        <span className={styles.dayNum}>{format(day, 'd')}</span>

                        <div className={styles.events}>
                          {daySingles.slice(0, MAX_PILLS).map(ev => renderPill(ev))}
                          {overflowCount > 0 && (
                            <button
                              className={styles.morePill}
                              onClick={e => {
                                e.stopPropagation();
                                setPopoverDay(isPopoverOpen ? null : day);
                              }}
                            >
                              +{overflowCount} more
                            </button>
                          )}
                        </div>

                        {isPopoverOpen && (
                          <div className={styles.popover} onClick={e => e.stopPropagation()}>
                            <div className={styles.popoverHead}>
                              <span>{format(day, 'MMMM d')}</span>
                              <button onClick={() => setPopoverDay(null)}>×</button>
                            </div>
                            {/* Show all events for this day (both spanning and single) */}
                            {[
                              ...spansOnDay.map(s => s.ev),
                              ...daySingles,
                            ].map(ev => renderPill(ev, { onAfterClick: () => setPopoverDay(null) }))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
