// @vitest-environment happy-dom
/**
 * Chrome visibility controls (loosening the previously-mandatory layout).
 *
 * Four regions can now be hidden — the left icon rail, the right panel, the
 * top toolbar, and the view-switcher tabs — via either:
 *   - explicit `show*` props on WorksCalendar, or
 *   - the persisted `display.chrome.*` config (set by the setup wizard /
 *     ConfigPanel).
 *
 * Resolution order is: explicit prop > persisted config > true (full chrome).
 * These tests pin each region's prop toggle, the config path, and the
 * prop-wins-over-config precedence. Everything defaults to "shown" so an
 * untouched calendar keeps its historical full-chrome layout.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { WorksCalendar } from '../WorksCalendar.tsx';

function seedConfig(calendarId: string, config: Record<string, unknown>) {
  localStorage.setItem(`wc-config-${calendarId}`, JSON.stringify(config));
}

afterEach(() => {
  localStorage.clear();
});

const viewTabs = (c: HTMLElement) => c.querySelectorAll('[data-wc-view-button]');

describe('WorksCalendar chrome visibility — defaults', () => {
  it('renders all chrome by default', () => {
    const { container } = render(<WorksCalendar calendarId="chrome-default" events={[]} />);
    expect(screen.getByRole('button', { name: 'Saved views' })).toBeInTheDocument();
    expect(viewTabs(container).length).toBeGreaterThan(0);
  });
});

describe('WorksCalendar chrome visibility — props', () => {
  it('showLeftRail={false} hides the left rail', () => {
    render(<WorksCalendar calendarId="chrome-norail" events={[]} showLeftRail={false} />);
    expect(screen.queryByRole('button', { name: 'Saved views' })).not.toBeInTheDocument();
  });

  it('showViewSwitcher={false} hides the view tabs but keeps the rest of the toolbar', () => {
    const { container } = render(
      <WorksCalendar calendarId="chrome-notabs" events={[]} showViewSwitcher={false} />,
    );
    expect(viewTabs(container).length).toBe(0);
    // The left rail is independent and still renders.
    expect(screen.getByRole('button', { name: 'Saved views' })).toBeInTheDocument();
  });

  it('showToolbar={false} hides the toolbar (and the tabs inside it)', () => {
    const { container } = render(
      <WorksCalendar calendarId="chrome-notoolbar" events={[]} showToolbar={false} />,
    );
    expect(viewTabs(container).length).toBe(0);
    // Rail is a separate region — still present.
    expect(screen.getByRole('button', { name: 'Saved views' })).toBeInTheDocument();
  });
});

describe('WorksCalendar chrome visibility — persisted config', () => {
  it('honors display.chrome.leftRail = false from saved config', () => {
    seedConfig('chrome-cfg-rail', { display: { chrome: { leftRail: false } } });
    render(<WorksCalendar calendarId="chrome-cfg-rail" events={[]} />);
    expect(screen.queryByRole('button', { name: 'Saved views' })).not.toBeInTheDocument();
  });

  it('honors display.chrome.viewSwitcher = false from saved config', () => {
    seedConfig('chrome-cfg-tabs', { display: { chrome: { viewSwitcher: false } } });
    const { container } = render(<WorksCalendar calendarId="chrome-cfg-tabs" events={[]} />);
    expect(viewTabs(container).length).toBe(0);
  });

  it('an explicit prop overrides the saved config', () => {
    // Config says hide the rail; the prop forces it back on.
    seedConfig('chrome-override', { display: { chrome: { leftRail: false } } });
    render(<WorksCalendar calendarId="chrome-override" events={[]} showLeftRail={true} />);
    expect(screen.getByRole('button', { name: 'Saved views' })).toBeInTheDocument();
  });
});
