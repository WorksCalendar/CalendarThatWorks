// @vitest-environment node
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import { WorksCalendar } from '../WorksCalendar.tsx';

describe('WorksCalendar SSR safety', () => {
  it('renders a static placeholder during SSR (no hydration mismatch)', () => {
    const html = renderToString(<WorksCalendar events={[]} />);
    // Server output must be deterministic and contain no calendar internals
    // (which depend on localStorage/window). The placeholder is rendered on
    // both the server and the first client render, so hydration matches.
    expect(html).toContain('works-calendar--ssr-placeholder');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('rbc-calendar');
  });

  it('does not throw when no window/localStorage is available', () => {
    expect(() => renderToString(<WorksCalendar events={[]} />)).not.toThrow();
  });
});
