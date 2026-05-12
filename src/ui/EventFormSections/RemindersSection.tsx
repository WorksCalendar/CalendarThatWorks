import { Bell, X } from 'lucide-react';
import type { ReminderDef } from '../../types/events';
import styles from './RemindersSection.module.css';

const PRESET_MINUTES = [5, 10, 15, 30, 60, 120, 1440] as const;

function labelFor(min: number): string {
  if (min < 60)   return `${min} min before`;
  if (min < 1440) return `${min / 60} hr before`;
  return `${min / 1440} day before`;
}

interface RemindersSectionProps {
  reminders: ReminderDef[];
  onChange: (reminders: ReminderDef[]) => void;
}

export function RemindersSection({ reminders, onChange }: RemindersSectionProps) {
  function add(minutesBefore: number) {
    if (reminders.some(r => r.minutesBefore === minutesBefore)) return;
    onChange([...reminders, { minutesBefore, method: 'browser' }]);
  }

  function remove(minutesBefore: number) {
    onChange(reminders.filter(r => r.minutesBefore !== minutesBefore));
  }

  function toggleMethod(minutesBefore: number) {
    onChange(reminders.map(r =>
      r.minutesBefore === minutesBefore
        ? { ...r, method: r.method === 'browser' ? 'callback' : 'browser' }
        : r,
    ));
  }

  const usedMinutes = new Set(reminders.map(r => r.minutesBefore));
  const available = PRESET_MINUTES.filter(m => !usedMinutes.has(m));

  return (
    <div className={styles['root']}>
      <div className={styles['header']}>
        <Bell size={13} aria-hidden="true" />
        <span>Reminders</span>
      </div>

      {reminders.length > 0 && (
        <ul className={styles['list']}>
          {reminders.map(r => (
            <li key={r.minutesBefore} className={styles['item']}>
              <span className={styles['itemLabel']}>{labelFor(r.minutesBefore)}</span>
              <button
                type="button"
                className={`${styles['methodBtn']} ${r.method === 'browser' ? styles['methodBtnActive'] : ''}`}
                onClick={() => toggleMethod(r.minutesBefore)}
                title={r.method === 'browser' ? 'Browser notification (click to switch to callback)' : 'Callback (click to switch to browser notification)'}
              >
                {r.method === 'browser' ? 'Notify' : 'Callback'}
              </button>
              <button type="button" className={styles['removeBtn']} onClick={() => remove(r.minutesBefore)} aria-label={`Remove ${labelFor(r.minutesBefore)} reminder`}>
                <X size={11} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <div className={styles['presets']}>
          {available.map(m => (
            <button key={m} type="button" className={styles['presetBtn']} onClick={() => add(m)}>
              + {labelFor(m)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
