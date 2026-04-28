// @vitest-environment happy-dom
/**
 * ConflictModal — ticket #134-13.
 *
 * The modal is the UX for conflictEngine violations. It renders a list of
 * violations with severity + rule badges, locks the "Proceed" action when
 * any hard violation is present, and calls cancel on overlay click / Escape.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';

import ConflictModal from '../ConflictModal';

const softResult = {
  violations: [
    { rule: 'rest', severity: 'soft', message: 'Only 30 min rest between shifts.' },
  ],
  severity: 'soft',
  allowed: true,
};

const hardResult = {
  violations: [
    {
      rule: 'ovr',
      severity: 'hard',
      message: 'Conflicts with "X" on the same resource.',
      conflictingEventId: 'x1',
    },
  ],
  severity: 'hard',
  allowed: false,
};

describe('ConflictModal — rendering', () => {
  it('returns null when result is null', () => {
    const { container } = render(
      <ConflictModal result={null} onProceed={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when severity is none', () => {
    const { container } = render(
      <ConflictModal
        result={{ violations: [], severity: 'none', allowed: true }}
        onProceed={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the violation message + rule id + severity tag', () => {
    render(<ConflictModal result={softResult} onProceed={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Only 30 min rest between shifts.')).toBeInTheDocument();
    expect(screen.getByText('rest')).toBeInTheDocument();
    expect(screen.getByText('soft')).toBeInTheDocument();
  });

  it('stamps the panel with data-severity', () => {
    render(<ConflictModal result={hardResult} onProceed={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('data-severity', 'hard');
  });
});

describe('ConflictModal — actions', () => {
  it('Proceed is enabled for soft-only violations', () => {
    const onProceed = vi.fn();
    render(<ConflictModal result={softResult} onProceed={onProceed} onCancel={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /Proceed anyway/ });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(onProceed).toHaveBeenCalledTimes(1);
  });

  it('Proceed is disabled for hard violations', () => {
    render(<ConflictModal result={hardResult} onProceed={vi.fn()} onCancel={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /Resolve to continue/ });
    expect(btn).toBeDisabled();
  });

  it('Cancel fires onCancel', () => {
    const onCancel = vi.fn();
    render(<ConflictModal result={softResult} onProceed={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Close button (×) fires onCancel', () => {
    const onCancel = vi.fn();
    render(<ConflictModal result={softResult} onProceed={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /Close conflict dialog/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('ConflictModal — pool-unresolvable details (#386 item #8)', () => {
  const poolResult = {
    violations: [
      {
        rule: 'pool-unresolvable',
        severity: 'hard',
        message: 'Pool "drivers" has no available member for the requested window.',
        details: {
          poolId: 'drivers',
          code: 'NO_AVAILABLE_MEMBER',
          evaluated: ['d1', 'd2', 'd3'],
        },
      },
    ],
    severity: 'hard',
    allowed: false,
  };

  it('renders the ordered evaluated trail so users see which members were tried', () => {
    render(<ConflictModal result={poolResult} onProceed={vi.fn()} onCancel={vi.fn()} />);
    const evaluated = screen.getByTestId('pool-evaluated');
    expect(evaluated).toHaveTextContent('Tried members: d1, d2, d3');
    // Screen-reader friendly aria-label spells the same thing out.
    expect(evaluated).toHaveAttribute('aria-label', 'Pool members tried: d1, d2, d3');
  });

  it('shows the structured error code in place of the rule tag', () => {
    render(<ConflictModal result={poolResult} onProceed={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('NO_AVAILABLE_MEMBER')).toBeInTheDocument();
  });

  it('omits the evaluated row when the trail is empty (e.g. POOL_DISABLED)', () => {
    const disabledResult = {
      violations: [
        {
          rule: 'pool-unresolvable',
          severity: 'hard',
          message: 'Pool "drivers" is disabled.',
          details: { poolId: 'drivers', code: 'POOL_DISABLED', evaluated: [] },
        },
      ],
      severity: 'hard',
      allowed: false,
    };
    render(<ConflictModal result={disabledResult} onProceed={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByTestId('pool-evaluated')).toBeNull();
    // Code still surfaces in the rule slot.
    expect(screen.getByText('POOL_DISABLED')).toBeInTheDocument();
  });

  it('does not affect non-pool violations (regression guard)', () => {
    render(<ConflictModal result={hardResult} onProceed={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByTestId('pool-evaluated')).toBeNull();
    expect(screen.getByText('ovr')).toBeInTheDocument();
  });
});
