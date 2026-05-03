import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameDay, isToday, startOfDay, addDays,
} from 'date-fns';
import type { Day } from 'date-fns';
import { useCalendarContext, resolveColor } from '../core/CalendarContext';
import ApprovalDot from '../ui/ApprovalDot';
import EventStatusBadge from '../ui/EventStatusBadge';
import styles from './WeekView.module.css';
import type { CalendarViewEvent } from '../types/ui';

const MAX_PILLS = 8;

type WeekViewEvent = CalendarViewEvent & { color?: string };

interface WeekViewProps {
  currentDate: Date;
  events: WeekViewEvent[];
  onEventClick?: (ev: WeekViewEvent) => void;
  onEventMove?: (ev: WeekViewEvent, newStart: Date, newEnd: Date) => void;
  onEventResize?: (ev: WeekViewEvent, newStart: Date, newEnd: Date) => void;
  onDateSelect?: (start: Date, end: Date) => void;
  config?: { display?: { dayStart?: number; dayEnd?: number } };
  weekStartDay?: Day;
}

export default function WeekView({
  currentDate, events, onEventClick, onEventMove, onDateSelect, weekStartDay = 0,
}: WeekViewProps) {
  const ctx = useCalendarContext();
  const [focusedDay,   setFocusedDay]   = useState(() => startOfDay(currentDate));
  const [overflowDay,  setOverflowDay]  = useState<Date | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setFocusedDay(startOfDay(currentDate));
  }, [currentDate]);

  const days = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: weekStartDay });
    const end   = endOfWeek(currentDate,   { weekStartsOn: weekStartDay });
    return eachDayOfInterval({ start, end });
  }, [currentDate, weekStartDay]);

  const weekStart = days[0]!;
  const weekEnd   = days[6]!;

  // All events — both single-day and multi-day — are shown as pills within
  // each day cell they fall on. Multi-day events appear in every day of the
  // visible week they overlap, so there is no separate all-day row.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, WeekViewEvent[]>();
    days.forEach(day => map.set(format(day, 'yyyy-MM-dd'), []));
    events.forEach(ev => {
      days.forEach(day => {
        const dayStart = startOfDay(day);
        const dayEnd   = new Date(dayStart.getTime() + 86_400_000 - 1);
        // Event overlaps this day if it starts before day-end and ends after day-start.
        if (ev.start <= dayEnd && ev.end > dayStart) {
          map.get(format(day, 'yyyy-MM-dd'))!.push(ev);
        }
      });
    });
    map.forEach((dayEvs, key) => {
      dayEvs.sort((a, b) => a.start.getTime() - b.start.getTime());
      map.set(key, dayEvs);
    });
    return map;
  }, [events, days]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const lastKeyNav = useRef(false);
  useEffect(() => {
    if (!lastKeyNav.current || !gridRef.current) return;
    lastKeyNav.current = false;
    const key = format(focusedDay, 'yyyy-MM-dd');
    const cell = gridRef.current.querySelector<HTMLElement>(`[data-date="${key}"]`);
    cell?.focus({ preventScroll: false });
  }, [focusedDay]);

  const handleCellKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>, day: Date) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault(); lastKeyNav.current = true;
        setFocusedDay(addDays(startOfDay(day), -1)); break;
      case 'ArrowRight':
        e.preventDefault(); lastKeyNav.current = true;
        setFocusedDay(addDays(startOfDay(day), 1)); break;
      case 'Enter': case ' ':
        e.preventDefault();
        if (onDateSelect) {
          const s = new Date(day); s.setHours(9, 0, 0, 0);
          const end = new Date(day); end.setHours(10, 0, 0, 0);
          onDateSelect(s, end);
        }
        break;
      default: return;
    }
  }, [onDateSelect]);

  // ── Pill drag (day-to-day only) ──────────────────────────────────────────
  type PillDrag = { ev: WeekViewEvent; startCol: number; colW: number; moved: boolean };
  const pillDragRef    = useRef<PillDrag | null>(null);
  const [pillTargetCol, setPillTargetCol] = useState<number | null>(null);
  const daysAreaRef    = useRef<HTMLDivElement | null>(null);

  function startPillDrag(ev: WeekViewEvent, e: ReactPointerEvent<HTMLButtonElement>, dayCol: number) {
    if (!ctx?.['permissions']?.canDrag) return;
    // No e.preventDefault() — that would suppress the synthesized click event.
    // setPointerCapture on daysArea redirects pointerup there, so click won't
    // fire on the pill button; handleDaysAreaPointerUp handles the tap case.
    e.stopPropagation();
    const grid = daysAreaRef.current;
    if (!grid) return;
    const colW = grid.getBoundingClientRect().width / 7;
    pillDragRef.current = { ev, startCol: dayCol, colW, moved: false };
    grid.setPointerCapture(e.pointerId);
    setPillTargetCol(dayCol);
  }

  function handleDaysAreaPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = pillDragRef.current;
    if (!d || !daysAreaRef.current) return;
    const rect = daysAreaRef.current.getBoundingClientRect();
    const col  = Math.max(0, Math.min(6, Math.floor((e.clientX - rect.left) / d.colW)));
    if (!d.moved && col !== d.startCol) d.moved = true;
    setPillTargetCol(col);
  }

  function handleDaysAreaPointerUp() {
    const d = pillDragRef.current;
    const targetCol = pillTargetCol;
    pillDragRef.current = null;
    setPillTargetCol(null);
    if (!d) return;
    if (!d.moved) {
      // Tap/click with no movement. setPointerCapture redirected pointerup to
      // daysArea so the pill's onClick never fires — trigger it manually here.
      onEventClick?.(d.ev);
      return;
    }
    if (targetCol === null) return;
    const diff = targetCol - d.startCol;
    if (diff === 0) return;
    onEventMove?.(d.ev, addDays(d.ev.start, diff), addDays(d.ev.end, diff));
  }

  // ── Renderers ─────────────────────────────────────────────────────────────
  function renderPill(ev: WeekViewEvent, dayCol?: number, onAfterClick?: () => void) {
    const color    = resolveColor(ev as never, ctx?.['colorRules']);
    const isDragging = pillDragRef.current?.ev.id === ev.id;
    const onClick  = () => { if (isDragging) return; onEventClick?.(ev); onAfterClick?.(); };
    const isConflicting = !!(ctx?.['conflictingEventIds'] as ReadonlySet<string> | undefined)?.has(ev.id);
    const statusClass   = ev.status === 'cancelled' ? styles['cancelled']
      : ev.status === 'tentative' ? styles['tentative'] : '';
    const timeLabel = ev.allDay ? 'All day' : format(ev.start, 'h:mm a');
    const ariaLabel = `${ev.title}, ${timeLabel}${ev.category ? `, ${ev.category}` : ''}`;

    const inner = ctx?.renderEvent
      ? ctx.renderEvent(ev, { view: 'week', isCompact: false, onClick, color })
      : null;

    return (
      <button key={ev.id}
        className={[styles['pill'], statusClass, isDragging && styles['dragging']].filter(Boolean).join(' ')}
        data-wc-event-id={ev.id}
        data-wc-conflicting={isConflicting ? 'true' : undefined}
        data-wc-priority={ev.visualPriority ?? undefined}
        style={{ '--ev-color': color }}
        onClick={e => { e.stopPropagation(); onClick(); }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onClick(); } }}
        onPointerDown={dayCol !== undefined ? (e: ReactPointerEvent<HTMLButtonElement>) => startPillDrag(ev, e, dayCol) : undefined}
        aria-label={ev.lifecycle ? `${ariaLabel}, lifecycle ${ev.lifecycle}` : ariaLabel}
      >
        {inner ?? (
          <>
            <ApprovalDot event={ev as never} />
            <EventStatusBadge lifecycle={(ev as { lifecycle?: unknown }).lifecycle as never} variant="compact" />
            {!ev.allDay && <span className={styles['pillTime']}>{format(ev.start, 'h:mm a')}</span>}
            <span className={styles['pillTitle']}>{ev.title}</span>
            {ev.resource && <span className={styles['pillResource']}>{ev.resource}</span>}
          </>
        )}
      </button>
    );
  }

  return (
    <div
      className={styles['week']}
      role="grid"
      aria-label={`Week of ${format(weekStart, 'MMMM d')} – ${format(weekEnd, 'MMMM d, yyyy')}`}
      ref={gridRef}
    >
      {/* ── Body (single scroll container — header sticky at top, cells below) ── */}
      <div className={styles['body']}>
        {/* Header: sticky inside the scroll container so both header and cell
            columns are always the same width, regardless of scrollbar presence. */}
        <div className={styles['headerRow']} role="row" aria-rowindex={1}>
          {days.map(day => (
            <div key={format(day, 'yyyy-MM-dd')}
              role="columnheader"
              aria-label={`${format(day, 'EEEE, MMMM d')}${isToday(day) ? ', today' : ''}`}
              className={[styles['dayHead'], isToday(day) && styles['todayHead']].filter(Boolean).join(' ')}
            >
              <span className={styles['dayAbbr']} aria-hidden="true">{format(day, 'EEE')}</span>
              <span className={[styles['dayNum'], isToday(day) && styles['todayNum']].filter(Boolean).join(' ')} aria-hidden="true">
                {format(day, 'd')}
              </span>
            </div>
          ))}
        </div>
        <div
          className={styles['daysArea']}
          ref={daysAreaRef}
          onPointerMove={handleDaysAreaPointerMove}
          onPointerUp={handleDaysAreaPointerUp}
          onPointerCancel={() => { pillDragRef.current = null; setPillTargetCol(null); }}
        >
          {/* Day cells — all events (single-day and multi-day) are pills here */}
          <div className={styles['weekCells']} role="row" aria-rowindex={2}>
            {days.map((day, di) => {
              const dayKey  = format(day, 'yyyy-MM-dd');
              const dayEvs  = eventsByDay.get(dayKey) || [];
              const isFocused = isSameDay(day, focusedDay);
              const overflow = Math.max(0, dayEvs.length - MAX_PILLS);
              const isOverflowOpen = overflowDay && isSameDay(overflowDay, day);
              const cellLabel = `${format(day, 'EEEE, MMMM d')}${isToday(day) ? ', today' : ''}${dayEvs.length > 0 ? `, ${dayEvs.length} event${dayEvs.length === 1 ? '' : 's'}` : ''}`;
              const isPillTarget = pillTargetCol === di && pillDragRef.current !== null;

              return (
                <div
                  key={dayKey}
                  role="gridcell"
                  tabIndex={isFocused ? 0 : -1}
                  data-date={dayKey}
                  aria-label={cellLabel}
                  aria-selected={isFocused}
                  className={[styles['cell'], isToday(day) && styles['todayCell'], isPillTarget && styles['pillDragTarget']].filter(Boolean).join(' ')}
                  onClick={() => {
                    setFocusedDay(startOfDay(day));
                    if (!onDateSelect) return;
                    const s = new Date(day); s.setHours(9, 0, 0, 0);
                    const e = new Date(day); e.setHours(10, 0, 0, 0);
                    onDateSelect(s, e);
                  }}
                  onKeyDown={e => handleCellKeyDown(e, day)}
                >
                  <div className={styles['events']}>
                    {dayEvs.slice(0, MAX_PILLS).map(ev => renderPill(ev, di))}
                    {overflow > 0 && (
                      <button
                        className={styles['moreLink']}
                        aria-label={`${overflow} more event${overflow === 1 ? '' : 's'} on ${format(day, 'MMMM d')}`}
                        aria-expanded={!!isOverflowOpen}
                        onClick={e => { e.stopPropagation(); setOverflowDay(isOverflowOpen ? null : day); }}
                      >
                        +{overflow} more
                      </button>
                    )}
                  </div>

                  {/* Per-day overflow popover */}
                  {isOverflowOpen && (
                    <div className={styles['overflowPopover']} onClick={e => e.stopPropagation()}>
                      <div className={styles['overflowHead']}>
                        <span>{format(day, 'MMMM d')}</span>
                        <button onClick={() => setOverflowDay(null)} aria-label="Close">×</button>
                      </div>
                      {dayEvs.slice(MAX_PILLS).map(ev => renderPill(ev, undefined, () => setOverflowDay(null)))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
