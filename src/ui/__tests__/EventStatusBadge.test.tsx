// @vitest-environment happy-dom
/**
 * EventStatusBadge — sprint-424 week 1.
 *
 * The badge is the canonical lifecycle visual; views render it in calendar
 * cells, hover cards, and the dispatch pipeline strip. It must:
 *   - render nothing when no lifecycle is supplied (so legacy events stay
 *     visually unchanged),
 *   - render an accessible status pill for every defined lifecycle, and
 *   - collapse to a bare dot in compact mode for use inside event pills.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';

import EventStatusBadge from '../EventStatusBadge';
import { EVENT_LIFECYCLE_STATES } from '../../types/events';

describe('EventStatusBadge', () => {
  it('renders nothing when no lifecycle is supplied', () => {
    const { container } = render(<EventStatusBadge lifecycle={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for an unknown lifecycle string', () => {
    const { container } = render(<EventStatusBadge lifecycle={'wibble'} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a labelled pill for every known lifecycle state', () => {
    for (const state of EVENT_LIFECYCLE_STATES) {
      const { unmount } = render(<EventStatusBadge lifecycle={state} />);
      const node = screen.getByRole('status');
      expect(node).toHaveAttribute('data-lifecycle', state);
      expect(node).toHaveAccessibleName(/Lifecycle:/);
      unmount();
    }
  });

  it('renders compact variant as an aria-labelled dot without text', () => {
    render(<EventStatusBadge lifecycle="approved" variant="compact" />);
    const node = screen.getByRole('img', { name: /Lifecycle: Approved/ });
    expect(node).toHaveAttribute('data-lifecycle', 'approved');
    expect(node.textContent).toBe('');
  });
});
