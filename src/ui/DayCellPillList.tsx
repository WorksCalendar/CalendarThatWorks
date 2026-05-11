import { useRef, useEffect, type ReactNode } from 'react';
import { useDragAndDrop, type DragEndEventData } from './dnd';
import { isSameDay, startOfDay } from 'date-fns';
import type { NormalizedEvent } from '../types/events';

type Props = {
  day: Date;
  events: NormalizedEvent[];
  maxPills: number;
  spansHeight: number;
  canDrag: boolean;
  onEventMove?: ((ev: NormalizedEvent, newStart: Date, newEnd: Date) => void) | undefined;
  /** Called with the event and its slot index; must include data-index={dataIndex} on the root. */
  renderPill: (ev: NormalizedEvent, dataIndex: number) => ReactNode;
  containerClass: string;
  /** Optional ghost pill node for the span-bar drag preview (a separate drag path). */
  ghostNode?: ReactNode | undefined;
};

/**
 * Renders a single day cell's event pills as a droppable list. All
 * DayCellPillList instances share droppableGroup "wc-month-pills" (via the
 * in-repo drag controller) so events can be dragged across day cells with
 * fluid reorder animations.
 */
export function DayCellPillList({
  day, events, maxPills, spansHeight, canDrag,
  onEventMove, renderPill, containerClass, ghostNode,
}: Props) {
  const isDraggingRef = useRef(false);
  // Block one prop sync after a cross-container drop while the parent confirms the move.
  const pendingDropRef = useRef(false);

  const [containerRef, localItems, setLocalItems] = useDragAndDrop<NormalizedEvent, HTMLDivElement>(
    events,
    {
      droppableGroup: 'wc-month-pills',
      animationDuration: 220,
      draggingClass: 'wc-pill-is-dragging',
      droppableClass: 'wc-pill-drop-target',
      isDraggable: () => canDrag,
      onDragStart: () => { isDraggingRef.current = true; },
      onDragEnd: ({ value }: DragEndEventData<NormalizedEvent>) => {
        isDraggingRef.current = false;
        if (isSameDay(value.start, day) || !onEventMove) return;
        pendingDropRef.current = true;
        const durationMs = value.end.getTime() - value.start.getTime();
        const newStart = new Date(startOfDay(day));
        if (!value.allDay) {
          newStart.setHours(value.start.getHours(), value.start.getMinutes(), 0, 0);
        }
        onEventMove(value, newStart, new Date(newStart.getTime() + durationMs));
      },
    },
  );

  useEffect(() => {
    if (isDraggingRef.current) return;
    if (pendingDropRef.current) {
      pendingDropRef.current = false;
      return;
    }
    setLocalItems(events);
  }, [events, setLocalItems]);

  return (
    <div ref={containerRef} className={containerClass} style={{ paddingTop: spansHeight }}>
      {localItems.slice(0, maxPills).map((ev, idx) => renderPill(ev, idx))}
      {ghostNode}
    </div>
  );
}
