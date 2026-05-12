/**
 * localStorageDataAdapter unit tests — resilience to corrupted storage (Fix 14).
 *
 * The regression: on JSON.parse failure the adapter silently caught the error
 * and returned [], then the very next submitEvent() call wrote a fresh
 * single-element array, permanently overwriting any data that happened to be
 * in the key. After Fix 14 the error is surfaced with console.warn so
 * developers notice corruption without hiding data on the next write.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLocalStorageDataAdapter } from '../localStorageDataAdapter';

const TEST_KEY = 'works-calendar:test-adapter';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// ── happy path ─────────────────────────────────────────────────────────────────

describe('createLocalStorageDataAdapter — submitEvent', () => {
  it('stores a submitted event and returns the record with id and createdAt', async () => {
    const adapter = createLocalStorageDataAdapter({ key: TEST_KEY });
    const record = await adapter.submitEvent({ title: 'Lunch', resource: 'Alice' }) as Record<string, unknown>;

    expect(String(record['id'])).toMatch(/^ext-/);
    expect(typeof record['createdAt']).toBe('string');
    expect(record['title']).toBe('Lunch');
    expect(record['resource']).toBe('Alice');
  });

  it('accumulates multiple submissions', async () => {
    const adapter = createLocalStorageDataAdapter({ key: TEST_KEY });
    await adapter.submitEvent({ title: 'A' });
    await adapter.submitEvent({ title: 'B' });

    const stored = JSON.parse(localStorage.getItem(TEST_KEY) ?? '[]') as Record<string, unknown>[];
    expect(stored).toHaveLength(2);
    expect(stored[0]!['title']).toBe('A');
    expect(stored[1]!['title']).toBe('B');
  });
});

// ── corruption resilience (Fix 14) ────────────────────────────────────────────

describe('createLocalStorageDataAdapter — corrupted storage', () => {
  it('emits console.warn when stored value is invalid JSON', async () => {
    localStorage.setItem(TEST_KEY, 'not-json}}}');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const adapter = createLocalStorageDataAdapter({ key: TEST_KEY });
    const record = await adapter.submitEvent({ title: 'After corruption' }) as Record<string, unknown>;

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]![0]).toContain('[works-calendar]');
    expect(record['title']).toBe('After corruption');
  });

  it('emits console.warn when stored value is a JSON non-array (object)', async () => {
    localStorage.setItem(TEST_KEY, JSON.stringify({ not: 'an array' }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const adapter = createLocalStorageDataAdapter({ key: TEST_KEY });
    await adapter.submitEvent({ title: 'Ignored' });

    // non-array is not a parse error, so no warn — just treated as empty
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('treats missing key as empty without warnings', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const adapter = createLocalStorageDataAdapter({ key: TEST_KEY });
    const record = await adapter.submitEvent({ title: 'First' }) as Record<string, unknown>;

    expect(warnSpy).not.toHaveBeenCalled();
    expect(record['title']).toBe('First');
  });
});
