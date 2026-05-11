import { describe, it, expect } from 'vitest';
import { validateDependencies } from '../validateDependencies';
import { makeDependency } from '../../schema/dependencySchema';
import type { ChangeShape, OperationContext } from '../validationTypes';
import type { EngineEvent } from '../../schema/eventSchema';

function makeEv(id: string, start: Date, end: Date): EngineEvent {
  return { id, title: id, start, end, allDay: false } as unknown as EngineEvent;
}

function makeDeps(...deps: Dependency[]): ReadonlyMap<string, Dependency> {
  return new Map(deps.map(d => [d.id, d]));
}

const t = (h: number) => new Date(2026, 0, 5, h, 0, 0);

// Predecessor A (9–10), Successor B wants to start at 10+ (FS link)
const evA = makeEv('A', t(9), t(10));
const evB = makeEv('B', t(10), t(11));

const fsLink = makeDependency('d1', { fromEventId: 'A', toEventId: 'B', type: 'finish-to-start', lagMs: 0 });

// ─── validateDependencies ─────────────────────────────────────────────────────

describe('validateDependencies', () => {
  it('returns null when ctx.dependencies is absent', () => {
    const change: ChangeShape = { newStart: t(8), newEnd: t(9), event: evB };
    expect(validateDependencies(change, {})).toBeNull();
  });

  it('returns null when ctx.dependencies is empty', () => {
    const change: ChangeShape = { newStart: t(8), newEnd: t(9), event: evB };
    expect(validateDependencies(change, { dependencies: new Map() })).toBeNull();
  });

  it('returns null when change.event has no id', () => {
    const noId = { ...evB, id: '' } as unknown as EngineEvent;
    const change: ChangeShape = { newStart: t(8), newEnd: t(9), event: noId };
    const ctx: OperationContext = { dependencies: makeDeps(fsLink), events: [evA, evB] };
    expect(validateDependencies(change, ctx)).toBeNull();
  });

  it('returns null when predecessor link is satisfied', () => {
    // B starts at 10, A ends at 10 → FS satisfied
    const change: ChangeShape = { newStart: t(10), newEnd: t(11), event: evB };
    const ctx: OperationContext = { dependencies: makeDeps(fsLink), events: [evA, evB] };
    expect(validateDependencies(change, ctx)).toBeNull();
  });

  it('returns hard violation when predecessor FS link is violated (B starts too early)', () => {
    // B wants to start at 9, but A ends at 10 → violation
    const change: ChangeShape = { newStart: t(9), newEnd: t(10), event: evB };
    const ctx: OperationContext = { dependencies: makeDeps(fsLink), events: [evA, evB] };
    const result = validateDependencies(change, ctx);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe('dependency-predecessor');
    expect(result!.severity).toBe('hard');
    expect(result!.conflictingEventId).toBe('A');
    expect(result!.details?.dependencyType).toBe('finish-to-start');
  });

  it('skips predecessor when predecessor event not in ctx.events', () => {
    const change: ChangeShape = { newStart: t(8), newEnd: t(9), event: evB };
    const ctx: OperationContext = { dependencies: makeDeps(fsLink), events: [] };
    // A is not in events → skip predecessor check
    expect(validateDependencies(change, ctx)).toBeNull();
  });

  it('returns soft violation when moving predecessor strands successor', () => {
    // A is moving forward (to t(11)–t(12)), successor B currently at t(10)–t(11)
    // B starts at 10 but new A ends at 12 → B violated
    const newA = makeEv('A', t(11), t(12));
    const change: ChangeShape = { newStart: t(11), newEnd: t(12), event: { ...evA } };
    const ctx: OperationContext = {
      dependencies: makeDeps(fsLink),
      events: [newA, evB],
    };
    const result = validateDependencies(change, ctx);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe('dependency-successor');
    expect(result!.severity).toBe('soft');
    expect(result!.conflictingEventId).toBe('B');
  });

  it('skips successor when successor event not in ctx.events', () => {
    const change: ChangeShape = { newStart: t(11), newEnd: t(12), event: evA };
    const ctx: OperationContext = { dependencies: makeDeps(fsLink), events: [] };
    expect(validateDependencies(change, ctx)).toBeNull();
  });

  it('uses ctx.events default when not provided', () => {
    const change: ChangeShape = { newStart: t(8), newEnd: t(9), event: evB };
    const ctx: OperationContext = { dependencies: makeDeps(fsLink) };
    // events defaults to [] → no predecessor found → null
    expect(validateDependencies(change, ctx)).toBeNull();
  });
});

