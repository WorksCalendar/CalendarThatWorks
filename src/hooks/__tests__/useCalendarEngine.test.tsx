/**
 * useCalendarEngine — runtime-guard regression tests.
 *
 * Covers the try/catch around the synchronous engine construction: a throw in
 * `createInitialState` (malformed `events`/`pools`) must surface with context,
 * not a bare/blank crash.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useCalendarEngine } from '../useCalendarEngine';
import type { ResourcePool } from '../../core/pools/resourcePoolSchema';

afterEach(() => cleanup());

// Stable references — `useCalendarEngine` syncs `allNormalized` into the engine
// in an effect keyed on its identity, so a fresh literal each render would loop.
const NO_EVENTS: never[] = [];
const ANNOUNCER_REF = { current: null };
const RANGE = { start: new Date(2026, 0, 1), end: new Date(2026, 1, 1) };

describe('useCalendarEngine — engine-init failures', () => {
  it('mounts normally with no init data', () => {
    const { result } = renderHook(() => useCalendarEngine({ allNormalized: NO_EVENTS, announcerRef: ANNOUNCER_REF, range: RANGE }));
    expect(result.current.engine).toBeTruthy();
    expect(result.current.undoManager).toBeTruthy();
  });

  it('rethrows an init failure with a "failed to initialize" message and the underlying cause', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // A pool whose `id` getter throws — `createInitialState` reads `p.id`.
    const poisonPool = {
      get id(): string { throw new Error('poison-pool'); },
    } as unknown as ResourcePool;

    expect(() =>
      renderHook(() => useCalendarEngine({ allNormalized: NO_EVENTS, rawPools: [poisonPool], announcerRef: ANNOUNCER_REF, range: RANGE })),
    ).toThrow(/failed to initialize.*poison-pool/i);

    errSpy.mockRestore();
  });
});
