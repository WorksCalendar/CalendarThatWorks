// @vitest-environment happy-dom
/**
 * DispatchView — action button click contract.
 *
 * The `View booking` / `View work` buttons must hand the FULL blocking
 * event object to `onEventClick`. Previously they passed the event's
 * id (a string), and the rest of the WorksCalendar pipeline expects an
 * event — HoverCard later crashes when it formats `event.start` /
 * `event.end`. This test pins the post-fix contract so the regression
 * cannot return silently.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import DispatchView from '../DispatchView';

const ASSETS = [
  { id: 'a-busy',    label: 'N801', meta: { base: 'b-logan' } },
  { id: 'a-maint',   label: 'N802', meta: { base: 'b-logan', status: 'maintenance' } },
];
const EMPLOYEES = [{ id: 'e1', name: 'Alex', base: 'b-logan' }];
const BASES = [{ id: 'b-logan', name: 'Logan' }];

const NOON = new Date('2026-04-26T12:00:00Z');

describe('DispatchView action buttons', () => {
  it('passes the full event object to onEventClick when "View booking" is clicked', () => {
    const blockingEvent = {
      id: 'mission-1',
      title: 'Trauma transport',
      start: '2026-04-26T08:00:00Z',
      end:   '2026-04-26T16:00:00Z',
      resource: 'a-busy',
      category: 'mission-assignment',
    };
    const onEventClick = vi.fn();
    render(
      <DispatchView
        events={[blockingEvent]}
        employees={EMPLOYEES}
        assets={[ASSETS[0]!]}
        bases={BASES}
        initialAsOf={NOON}
        onEventClick={onEventClick}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'View booking' }));
    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(onEventClick).toHaveBeenCalledWith(blockingEvent);
  });

  it('passes the full event object to onEventClick when "View work" is clicked', () => {
    const maintEvent = {
      id: 'wo-1',
      title: '50hr inspection',
      start: '2026-04-26T08:00:00Z',
      end:   '2026-04-26T20:00:00Z',
      resource: 'a-maint',
      category: 'maintenance',
    };
    const onEventClick = vi.fn();
    render(
      <DispatchView
        events={[maintEvent]}
        employees={EMPLOYEES}
        assets={[ASSETS[1]!]}
        bases={BASES}
        initialAsOf={NOON}
        onEventClick={onEventClick}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'View work' }));
    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(onEventClick).toHaveBeenCalledWith(maintEvent);
  });
});

describe('DispatchView as-of navigation', () => {
  it('does not invoke onAsOfChange on initial mount', () => {
    const onAsOfChange = vi.fn();
    render(
      <DispatchView
        events={[]}
        employees={EMPLOYEES}
        assets={[ASSETS[0]!]}
        bases={BASES}
        initialAsOf={NOON}
        onAsOfChange={onAsOfChange}
      />,
    );
    expect(onAsOfChange).not.toHaveBeenCalled();
  });

  it('invokes onAsOfChange when the user changes the as-of input', () => {
    const onAsOfChange = vi.fn();
    render(
      <DispatchView
        events={[]}
        employees={EMPLOYEES}
        assets={[ASSETS[0]!]}
        bases={BASES}
        initialAsOf={NOON}
        onAsOfChange={onAsOfChange}
      />,
    );
    const input = screen.getByLabelText('As of') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-05-15T09:30' } });
    expect(onAsOfChange).toHaveBeenCalledTimes(1);
    expect(onAsOfChange.mock.calls[0]![0]).toBeInstanceOf(Date);
  });

  it('invokes onAsOfChange when the user clicks "Now"', () => {
    const onAsOfChange = vi.fn();
    render(
      <DispatchView
        events={[]}
        employees={EMPLOYEES}
        assets={[ASSETS[0]!]}
        bases={BASES}
        initialAsOf={NOON}
        onAsOfChange={onAsOfChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Now' }));
    expect(onAsOfChange).toHaveBeenCalledTimes(1);
  });
});
