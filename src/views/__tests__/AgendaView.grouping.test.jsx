import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import AgendaView from '../AgendaView.jsx';
import { CalendarContext } from '../../core/CalendarContext.js';

const currentDate = new Date(2026, 3, 1); // April 2026

const sameDay = new Date(2026, 3, 5); // April 5
const otherDay = new Date(2026, 3, 6); // April 6

const events = [
  { id: 'e1', title: 'Morning Run',  category: 'Exercise', start: sameDay, end: sameDay, allDay: true },
  { id: 'e2', title: 'Lunch Walk',   category: 'Exercise', start: sameDay, end: sameDay, allDay: true },
  { id: 'e3', title: 'Team Meeting', category: 'Work',     start: sameDay, end: sameDay, allDay: true },
];

function renderAgenda(props = {}) {
  return render(
    <CalendarContext.Provider value={null}>
      <AgendaView
        currentDate={currentDate}
        events={events}
        onEventClick={vi.fn()}
        {...props}
      />
    </CalendarContext.Provider>,
  );
}

describe('AgendaView grouping', () => {
  it('renders a GroupHeader treeitem for each category when groupBy is set', () => {
    renderAgenda({ groupBy: 'category' });
    const tree = screen.getByRole('tree');
    const items = within(tree).getAllByRole('treeitem');
    const labels = items.map(i => i.textContent);
    expect(labels.some(l => l?.startsWith('Exercise'))).toBe(true);
    expect(labels.some(l => l?.startsWith('Work'))).toBe(true);
  });

  it('events appear under their correct sub-group', () => {
    renderAgenda({ groupBy: 'category' });
    const [first, second] = screen.getAllByRole('treeitem');
    // Insertion order: Exercise first (2 events), then Work (1 event)
    expect(first.textContent).toMatch(/Exercise/);
    expect(first.textContent).toMatch(/2/);
    expect(second.textContent).toMatch(/Work/);
    expect(second.textContent).toMatch(/1/);
    expect(screen.getByText('Morning Run')).toBeInTheDocument();
    expect(screen.getByText('Lunch Walk')).toBeInTheDocument();
    expect(screen.getByText('Team Meeting')).toBeInTheDocument();
  });

  it('renders no group headers when groupBy is not set', () => {
    renderAgenda();
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
    expect(screen.queryByRole('treeitem')).not.toBeInTheDocument();
    // Events still visible
    expect(screen.getByText('Morning Run')).toBeInTheDocument();
    expect(screen.getByText('Team Meeting')).toBeInTheDocument();
  });

  it('clicking a group header toggles collapse state', () => {
    renderAgenda({ groupBy: 'category' });
    const exerciseHeader = screen.getAllByRole('treeitem').find(i => i.textContent?.startsWith('Exercise'));
    expect(exerciseHeader).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Morning Run')).toBeInTheDocument();

    fireEvent.click(exerciseHeader);
    expect(exerciseHeader).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Morning Run')).not.toBeInTheDocument();
    expect(screen.queryByText('Lunch Walk')).not.toBeInTheDocument();
    // Work group is unaffected
    expect(screen.getByText('Team Meeting')).toBeInTheDocument();
  });

  it('supports multi-level nested groupBy arrays', () => {
    const multiEvents = [
      { id: 'a', title: 'PT A', category: 'Work', start: sameDay, end: sameDay, resource: 'Alice', allDay: true },
      { id: 'b', title: 'PT B', category: 'Work', start: sameDay, end: sameDay, resource: 'Bob',   allDay: true },
      { id: 'c', title: 'Run',  category: 'Exercise', start: sameDay, end: sameDay, resource: 'Alice', allDay: true },
    ];
    render(
      <CalendarContext.Provider value={null}>
        <AgendaView
          currentDate={currentDate}
          events={multiEvents}
          onEventClick={vi.fn()}
          groupBy={['category', 'resource']}
        />
      </CalendarContext.Provider>,
    );
    // Top-level groups: Exercise, Work — rendered as depth-0 treeitems
    const topLevel = screen.getAllByRole('treeitem').filter(i => i.getAttribute('aria-level') === '1');
    expect(topLevel).toHaveLength(2);
    // Nested groups: resources under each category — depth-1
    const secondLevel = screen.getAllByRole('treeitem').filter(i => i.getAttribute('aria-level') === '2');
    // Alice appears under both Exercise and Work → 2 occurrences
    const aliceHeaders = secondLevel.filter(h => h.textContent?.startsWith('Alice'));
    expect(aliceHeaders.length).toBeGreaterThanOrEqual(2);
  });

  it('does not resort by start when a sort prop is provided', () => {
    // Events deliberately passed in a non-chronological order.
    const d1 = new Date(2026, 3, 5, 9);
    const d2 = new Date(2026, 3, 5, 14);
    const ordered = [
      { id: 'late',  title: 'Late',  start: d2, end: d2 },
      { id: 'early', title: 'Early', start: d1, end: d1 },
    ];
    render(
      <CalendarContext.Provider value={null}>
        <AgendaView
          currentDate={currentDate}
          events={ordered}
          onEventClick={vi.fn()}
          sort={[{ field: 'title', direction: 'asc' }]}
        />
      </CalendarContext.Provider>,
    );
    const titles = screen.getAllByText(/Late|Early/);
    // With a sort prop, upstream ordering is trusted — Late comes first.
    expect(titles[0].textContent).toBe('Late');
    expect(titles[1].textContent).toBe('Early');
  });

  describe('showAllGroups', () => {
    it('renders each event in every leaf bucket, marking non-matching copies as cross-group', () => {
      render(
        <CalendarContext.Provider value={null}>
          <AgendaView
            currentDate={currentDate}
            events={events}
            onEventClick={vi.fn()}
            groupBy="category"
            showAllGroups
          />
        </CalendarContext.Provider>,
      );
      // 3 events × 2 groups = 6 event renders
      const runInstances = screen.getAllByText('Morning Run');
      expect(runInstances).toHaveLength(2);
      const meetingInstances = screen.getAllByText('Team Meeting');
      expect(meetingInstances).toHaveLength(2);

      // One instance of each event is native (not dimmed); the others are cross-group.
      const crossGroupEls = document.querySelectorAll('[data-cross-group="true"]');
      // 3 events, each duplicated into 1 other bucket → 3 cross-group nodes.
      expect(crossGroupEls).toHaveLength(3);

      // Cross-group copies show a "from <source>" badge.
      expect(screen.getAllByText(/from Exercise/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/from Work/i).length).toBeGreaterThan(0);
    });

    it('does not duplicate events when showAllGroups is off (default)', () => {
      renderAgenda({ groupBy: 'category' });
      expect(screen.getAllByText('Morning Run')).toHaveLength(1);
      expect(screen.getAllByText('Team Meeting')).toHaveLength(1);
      expect(document.querySelectorAll('[data-cross-group="true"]')).toHaveLength(0);
    });

    it('does nothing special when showAllGroups is on but groupBy is unset', () => {
      renderAgenda({ showAllGroups: true });
      // No grouping → no duplication, no crossGroup markers.
      expect(screen.getAllByText('Morning Run')).toHaveLength(1);
      expect(document.querySelectorAll('[data-cross-group="true"]')).toHaveLength(0);
    });
  });

  it('applies default start-time sort per day when no sort prop is given', () => {
    const d1 = new Date(2026, 3, 5, 9);
    const d2 = new Date(2026, 3, 5, 14);
    const ordered = [
      { id: 'late',  title: 'Late',  start: d2, end: d2 },
      { id: 'early', title: 'Early', start: d1, end: d1 },
    ];
    render(
      <CalendarContext.Provider value={null}>
        <AgendaView
          currentDate={currentDate}
          events={ordered}
          onEventClick={vi.fn()}
        />
      </CalendarContext.Provider>,
    );
    const titles = screen.getAllByText(/Late|Early/);
    expect(titles[0].textContent).toBe('Early');
    expect(titles[1].textContent).toBe('Late');
  });
});
