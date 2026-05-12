import styles from './CalendarLegend.module.css';

export interface LegendSource {
  id: string;
  label: string;
  color: string;
  enabled: boolean;
  eventCount?: number;
}

export interface CalendarLegendProps {
  sources: LegendSource[];
  onToggle: (id: string) => void;
  onColorChange?: (id: string, color: string) => void;
}

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#ef4444', '#f59e0b',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
];

export default function CalendarLegend({ sources, onToggle, onColorChange }: CalendarLegendProps) {
  if (sources.length === 0) return null;

  return (
    <div className={styles['root']}>
      <p className={styles['heading']}>Calendars</p>
      <ul className={styles['list']} role="list">
        {sources.map(src => (
          <li key={src.id} className={styles['item']}>
            <button
              type="button"
              className={`${styles['dot']} ${!src.enabled ? styles['dotDisabled'] : ''}`}
              style={{ '--legend-color': src.color } as React.CSSProperties}
              onClick={() => onColorChange && cycleColor(src.color, id => onColorChange(src.id, id))}
              title={onColorChange ? 'Click to change colour' : undefined}
              aria-label={`${src.label} colour`}
            />
            <button
              type="button"
              className={`${styles['label']} ${!src.enabled ? styles['labelDisabled'] : ''}`}
              onClick={() => onToggle(src.id)}
              aria-pressed={src.enabled}
              title={src.enabled ? 'Hide calendar' : 'Show calendar'}
            >
              {src.label || 'Unnamed calendar'}
            </button>
            {src.eventCount != null && (
              <span className={styles['count']}>{src.eventCount}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function cycleColor(current: string, onChange: (color: string) => void) {
  const idx = PRESET_COLORS.indexOf(current);
  onChange(PRESET_COLORS[(idx + 1) % PRESET_COLORS.length]!);
}
