import type { ReactNode } from 'react';
import type { NormalizedEvent } from '../types/events';

type Props = {
  events: NormalizedEvent[];
  maxPills: number;
  spansHeight: number;
  /** Renders a single pill. The returned element must carry its own React key. */
  renderPill: (ev: NormalizedEvent) => ReactNode;
  containerClass: string;
  /** Optional ghost pill node shown while a drag targets this cell. */
  ghostNode?: ReactNode | undefined;
};

/**
 * Lays out a single day cell's event pills (up to `maxPills`). Reserves
 * `spansHeight` of top padding for MonthView's absolutely-positioned spans
 * layer. Drag-to-reschedule is owned by MonthView's pointer drag — the pills
 * carry an `onPointerDown` from `renderPill`; this component just renders them.
 */
export function DayCellPillList({ events, maxPills, spansHeight, renderPill, containerClass, ghostNode }: Props) {
  return (
    <div className={containerClass} style={{ paddingTop: spansHeight }}>
      {events.slice(0, maxPills).map((ev) => renderPill(ev))}
      {ghostNode}
    </div>
  );
}
