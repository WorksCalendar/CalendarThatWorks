/**
 * EventStatusBadge — visual marker for the lifecycle a calendar event is in.
 *
 * Renders one of `draft | pending | approved | scheduled | completed` as a
 * coloured pill (or, in `compact` mode, a bare coloured dot for use inside
 * dense calendar cells where a full pill would crowd the title).
 *
 * Returns null when the event has no lifecycle state, so views can drop it
 * in unconditionally without sprouting empty wrappers for every legacy
 * event.
 */
import type { EventLifecycleState } from '../types/events';
import { isLifecycleState } from '../types/events';
import styles from './EventStatusBadge.module.css';

const STATE_LABEL: Record<EventLifecycleState, string> = {
  draft:      'Draft',
  pending:    'Pending',
  approved:   'Approved',
  scheduled:  'Scheduled',
  completed:  'Completed',
};

const STATE_TITLE: Record<EventLifecycleState, string> = {
  draft:      'Draft — not yet submitted',
  pending:    'Pending approval',
  approved:   'Approved — awaiting schedule',
  scheduled:  'Scheduled and confirmed',
  completed:  'Completed',
};

export type EventStatusBadgeProps = {
  /** Lifecycle to render. Pass anything; non-lifecycle values render null. */
  lifecycle: EventLifecycleState | string | null | undefined;
  /** `compact` collapses the pill into a 7px dot for use inside event pills. */
  variant?: 'pill' | 'compact';
  /** `md` bumps the type a step for headers / hover cards. */
  size?: 'sm' | 'md';
  className?: string;
};

export default function EventStatusBadge({
  lifecycle,
  variant = 'pill',
  size = 'sm',
  className,
}: EventStatusBadgeProps): JSX.Element | null {
  if (!isLifecycleState(lifecycle)) return null;
  const label = STATE_LABEL[lifecycle];
  const title = STATE_TITLE[lifecycle];

  const cls = [
    styles['badge'],
    styles[`state_${lifecycle}`],
    variant === 'compact' ? styles['compact'] : null,
    size === 'md' ? styles['size_md'] : null,
    className,
  ].filter(Boolean).join(' ');

  if (variant === 'compact') {
    return (
      <span
        className={cls}
        role="img"
        aria-label={`Lifecycle: ${label}`}
        title={title}
        data-lifecycle={lifecycle}
      />
    );
  }

  return (
    <span
      className={cls}
      role="status"
      aria-label={`Lifecycle: ${label}`}
      title={title}
      data-lifecycle={lifecycle}
    >
      <span className={styles['dot']} aria-hidden="true" />
      <span className={styles['label']}>{label}</span>
    </span>
  );
}
