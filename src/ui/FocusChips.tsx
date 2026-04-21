/**
 * FocusChips — visible quick-filter chip strip (issue #268 Task 4).
 *
 * Mental model: "Focus" is a first-class, always-visible row of one-tap
 * filter chips. No panel-opening required. Each chip maps to a set of
 * category ids; clicking atomically toggles the full set on/off in the
 * calendar's `categories` filter (which is the default schema key used
 * by buildDefaultFilterSchema).
 *
 * When nothing is active, all events show (normal calendar behavior).
 * When any chip is active, only events in the union of active chips'
 * categories render.
 */
import { Radio, Plane, Wrench, FileText } from 'lucide-react';
import styles from './FocusChips.module.css';

export type FocusChipDef = {
  /** Stable id, used for keys and aria. */
  id: string;
  /** Short label, e.g. "Dispatch". */
  label: string;
  /** Categories this chip toggles on the `categories` filter. */
  categories: string[];
  /** Optional icon name (bundled set). Falls back to no icon. */
  icon?: 'radio' | 'plane' | 'wrench' | 'file';
};

/**
 * Default chip list for operational calendars. Hosts can override via the
 * `focusChips` prop on <WorksCalendar />. The Air EMS demo uses exactly these.
 */
export const DEFAULT_FOCUS_CHIPS: FocusChipDef[] = [
  { id: 'dispatch',    label: 'Dispatch',    categories: ['dispatch'],                 icon: 'radio' },
  { id: 'flights',     label: 'Flights',     categories: ['mission', 'shift'],         icon: 'plane' },
  { id: 'maintenance', label: 'Maintenance', categories: ['maintenance'],              icon: 'wrench' },
  { id: 'requests',    label: 'Requests',    categories: ['request'],                  icon: 'file' },
];

const ICON_MAP = {
  radio: Radio,
  plane: Plane,
  wrench: Wrench,
  file: FileText,
} as const;

export type FocusChipsProps = {
  chips?: FocusChipDef[];
  /** Current active categories Set (from cal.filters.categories). */
  activeCategories: Set<string> | undefined | null;
  /** Replace the active-categories set. */
  onCategoriesChange: (next: Set<string>) => void;
};

/** A chip is "active" only when every one of its categories is in the set. */
function chipIsActive(chip: FocusChipDef, active: Set<string> | null | undefined): boolean {
  if (!active || active.size === 0) return false;
  return chip.categories.every(c => active.has(c));
}

/**
 * Atomically toggle a chip's categories:
 *   - fully active → remove all of them
 *   - partial or inactive → add any missing ones (treat the chip as one unit)
 */
function toggleChip(chip: FocusChipDef, active: Set<string> | null | undefined): Set<string> {
  const next = new Set(active ?? []);
  if (chipIsActive(chip, next)) {
    chip.categories.forEach(c => next.delete(c));
  } else {
    chip.categories.forEach(c => next.add(c));
  }
  return next;
}

export default function FocusChips({
  chips = DEFAULT_FOCUS_CHIPS,
  activeCategories,
  onCategoriesChange,
}: FocusChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className={styles.row} role="toolbar" aria-label="Focus filters">
      <span className={styles.label}>Focus</span>
      {chips.map(chip => {
        const Icon = chip.icon ? ICON_MAP[chip.icon] : null;
        const active = chipIsActive(chip, activeCategories);
        return (
          <button
            key={chip.id}
            type="button"
            className={[styles.chip, active && styles.chipActive].filter(Boolean).join(' ')}
            onClick={() => onCategoriesChange(toggleChip(chip, activeCategories))}
            aria-pressed={active}
            title={`Focus on ${chip.label.toLowerCase()}`}
          >
            {Icon && <Icon size={13} aria-hidden="true" />}
            <span>{chip.label}</span>
          </button>
        );
      })}
    </div>
  );
}
