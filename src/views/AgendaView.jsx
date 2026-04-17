import { useMemo, useState, useCallback } from 'react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval,
  format, isSameDay, isToday,
} from 'date-fns';
import { useCalendarContext, resolveColor } from '../core/CalendarContext.js';
import { buildGroupTree } from '../hooks/useGrouping.ts';
import GroupHeader from '../ui/GroupHeader.tsx';
import styles from './AgendaView.module.css';

export default function AgendaView({ currentDate, events, onEventClick, groupBy, sort }) {
  const ctx = useCalendarContext();

  const days = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end   = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // When an upstream `sort` is set, trust the incoming order and skip the
  // default chronological resort so user sort wins. When no sort is set,
  // keep the historical start-time ordering per day.
  const hasSort = Array.isArray(sort) ? sort.length > 0 : !!sort;

  const grouped = useMemo(() => {
    return days
      .map(day => {
        const dayEvents = events.filter(e => isSameDay(e.start, day));
        return {
          day,
          events: hasSort
            ? dayEvents
            : [...dayEvents].sort((a, b) => a.start - b.start),
        };
      })
      .filter(g => g.events.length > 0);
  }, [days, events, hasSort]);

  // Per-day group trees built from the event-level grouping engine. Pure —
  // no collapse state baked in; that lives in local React state below.
  const dayTrees = useMemo(() => {
    if (!groupBy) return null;
    return grouped.map(({ day, events: dayEvents }) => ({
      day,
      tree: buildGroupTree(dayEvents, groupBy),
    }));
  }, [grouped, groupBy]);

  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const toggleGroup = useCallback((path) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  function renderEventItem(ev) {
    const color = resolveColor(ev, ctx?.colorRules);
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
  }

  // Count every leaf event reachable under a group (respecting nested trees).
  function countEvents(group) {
    if (group.children.length === 0) return group.events.length;
    return group.children.reduce((sum, c) => sum + countEvents(c), 0);
  }

  function renderGroupNode(group, parentPath, posInSet, setSize) {
    const path = parentPath ? `${parentPath}/${group.key}` : group.key;
    const collapsed = collapsedGroups.has(path);
    const total = countEvents(group);
    return (
      <div key={path} className={styles.subGroup} role="group">
        <GroupHeader
          label={group.label}
          count={total}
          depth={group.depth}
          collapsed={collapsed}
          onToggle={() => toggleGroup(path)}
          posInSet={posInSet}
          setSize={setSize}
          fieldLabel={group.field}
        />
        {!collapsed && (
          group.children.length > 0
            ? group.children.map((child, i) =>
                renderGroupNode(child, path, i + 1, group.children.length),
              )
            : group.events.map(renderEventItem)
        )}
      </div>
    );
  }

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
      {grouped.map(({ day, events: dayEvents }, idx) => {
        const tree = dayTrees?.[idx]?.tree ?? null;
        return (
          <div key={format(day, 'yyyy-MM-dd')} className={styles.group}>
            <div className={[styles.dateHead, isToday(day) && styles.today].filter(Boolean).join(' ')}>
              <span className={styles.dayName}>{format(day, 'EEE')}</span>
              <span className={styles.dayNum}>{format(day, 'd')}</span>
              <span className={styles.monthLabel}>{format(day, 'MMM yyyy')}</span>
            </div>
            <div className={styles.events} role={tree && tree.length > 0 ? 'tree' : undefined}>
              {tree && tree.length > 0
                ? tree.map((g, i) => renderGroupNode(g, format(day, 'yyyy-MM-dd'), i + 1, tree.length))
                : dayEvents.map(renderEventItem)
              }
            </div>
          </div>
        );
      })}
    </div>
  );
}
