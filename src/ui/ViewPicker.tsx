/**
 * ViewPicker — Single dropdown replacing the 7-button calendar view switcher.
 *
 * Shows the current view label with a chevron; opens a menu of all enabled
 * views (each with its icon + optional hint). Intended to keep the toolbar
 * chrome slim so more horizontal space stays available for the saved-view
 * chip strip.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  CalendarDays, Calendar, Columns3, List, CalendarRange, Boxes, MapPin,
} from 'lucide-react';
import styles from './ViewPicker.module.css';

const VIEW_ICON_MAP: Record<string, any> = {
  month:    CalendarDays,
  week:     Columns3,
  day:      Calendar,
  agenda:   List,
  schedule: CalendarRange,
  base:     MapPin,
  assets:   Boxes,
};

type ViewOption = {
  id: string;
  label: string;
  hint?: string;
};

type Props = {
  views: readonly ViewOption[];
  activeView: string;
  onChange: (id: string) => void;
};

export default function ViewPicker({ views, activeView, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const active = views.find(v => v.id === activeView) ?? views[0];
  const ActiveIcon = active ? VIEW_ICON_MAP[active.id] : null;

  return (
    <div ref={rootRef} className={styles['root']}>
      <button
        type="button"
        className={styles['trigger']}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Change view"
        title={active?.hint ?? active?.label}
      >
        {ActiveIcon && <ActiveIcon size={14} aria-hidden="true" />}
        <span className={styles['label']}>{active?.label ?? 'View'}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles['menu']} role="menu" aria-label="Calendar view">
          {views.map(v => {
            const Icon = VIEW_ICON_MAP[v.id];
            const isActive = v.id === activeView;
            return (
              <button
                key={v.id}
                type="button"
                role="menuitem"
                className={[styles['item'], isActive && styles['itemActive']].filter(Boolean).join(' ')}
                onClick={() => { onChange(v.id); setOpen(false); }}
                aria-label={v.label}
              >
                {Icon && <Icon size={14} aria-hidden="true" className={styles['itemIcon']} />}
                <span className={styles['itemLabel']}>{v.label}</span>
                {v.hint && <span className={styles['itemHint']}>{v.hint}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
