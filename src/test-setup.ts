import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { useRef, useState } from 'react';

// DayCellPillList renders one droppable list per day cell (~35 in month view).
// The real drag controller is cheap to mount (a Map entry + one shared
// document listener), but tests don't drive pointer drags, so stub the hook to
// a pass-through to keep month-view rendering tests focused. The controller
// itself is covered by src/ui/dnd/__tests__.
vi.mock('./ui/dnd', () => ({
  useDragAndDrop: <T,>(items: T[]) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const [localItems, setLocalItems] = useState<T[]>(items);
    return [ref, localItems, setLocalItems, () => {}, () => {}] as const;
  },
}));
