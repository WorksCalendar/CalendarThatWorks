import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { useRef, useState } from 'react';

// fluid-dnd sets up MutationObservers + event listeners on every droppable
// element. In a month-view test environment that mounts ~35 day cells, this
// causes excessive DOM overhead and test timeouts. Mock the hook to a simple
// pass-through so tests stay fast while still exercising rendering logic.
vi.mock('fluid-dnd/react', () => ({
  useDragAndDrop: <T,>(items: T[]) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const [localItems, setLocalItems] = useState<T[]>(items);
    return [ref, localItems, setLocalItems, () => {}, () => {}] as const;
  },
}));
