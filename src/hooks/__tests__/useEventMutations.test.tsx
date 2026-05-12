/**
 * useEventMutations — runtime-guard regression tests.
 *
 * Covers the invalid-date guard in `handleEventSave`: an unparseable
 * start/end must be rejected before it reaches the engine (where it would
 * propagate into `date-fns` formatting and throw `RangeError`).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useEventMutations } from '../useEventMutations';
import { CalendarEngine } from '../../core/engine/CalendarEngine';
import type { MutationEventInput } from '../../types/engineOps';

afterEach(() => cleanup());

const NO_EVENTS: never[] = [];
const OWNER_CFG = {};

function setup() {
  const applyEngineOp = vi.fn();
  const applyWithRecurringCheck = vi.fn();
  const engine = new CalendarEngine();
  const getSavedEventPayload = vi.fn(() => null);
  const setFormEvent = vi.fn();
  const setInlineEditTarget = vi.fn();
  const { result } = renderHook(() =>
    useEventMutations({
      applyEngineOp,
      applyWithRecurringCheck,
      getSavedEventPayload,
      engine,
      engineVer: 0,
      expandedEvents: NO_EVENTS,
      ownerConfig: OWNER_CFG,
      inlineEditTarget: null,
      setFormEvent,
      setInlineEditTarget,
    }),
  );
  return { result, applyEngineOp, applyWithRecurringCheck };
}

describe('useEventMutations — handleEventSave invalid-date guard', () => {
  it('drops a save with an unparseable start date (no engine op, logs an error)', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, applyEngineOp, applyWithRecurringCheck } = setup();

    act(() => result.current.handleEventSave({ start: 'not a date', end: new Date(2026, 0, 1) } as MutationEventInput));

    expect(applyEngineOp).not.toHaveBeenCalled();
    expect(applyWithRecurringCheck).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('drops a save with an unparseable end date', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, applyEngineOp } = setup();

    act(() => result.current.handleEventSave({ start: new Date(2026, 0, 1), end: 'whenever' } as MutationEventInput));

    expect(applyEngineOp).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('still creates an event when start/end are valid', () => {
    const { result, applyEngineOp } = setup();

    act(() =>
      result.current.handleEventSave({
        title: 'New thing',
        start: new Date(2026, 0, 1, 9, 0),
        end: new Date(2026, 0, 1, 10, 0),
      } as MutationEventInput),
    );

    expect(applyEngineOp).toHaveBeenCalledTimes(1);
    const [op] = applyEngineOp.mock.calls[0] as [{ type: string }];
    expect(op.type).toBe('create');
  });
});
