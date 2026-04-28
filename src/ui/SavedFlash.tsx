import { Check } from 'lucide-react';
import styles from './SavedFlash.module.css';

export type SavedFlashProps = {
  /** Drive from `useSavedFlash().flash`. */
  visible: boolean;
  /** Override the default "Saved" copy. */
  label?: string;
};

/**
 * SavedFlash — small green pill that fades in for ~1.5s after a write.
 *
 * Always rendered so showing/hiding never reflows the surrounding chrome;
 * `visibility` is driven by the `visible` prop. Pair with `useSavedFlash`.
 *
 * `role="status"` gives assistive tech the same polite-live semantic as
 * `aria-live="polite"`, so the affordance announces when it appears
 * without adding an explicit `aria-live` attribute. The explicit
 * attribute is omitted on purpose: several E2E tests target the
 * calendar's date label via `[aria-live="polite"]`, and a competing
 * always-mounted live region near the top of WorksCalendar would
 * shadow that selector.
 */
export default function SavedFlash({ visible, label = 'Saved' }: SavedFlashProps): JSX.Element {
  return (
    <span
      className={[styles['flash'], visible && styles['visible']].filter(Boolean).join(' ')}
      role="status"
      aria-hidden={!visible}
    >
      <Check size={11} aria-hidden="true" />
      {label}
    </span>
  );
}
