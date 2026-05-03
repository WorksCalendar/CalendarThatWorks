import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WalkthroughHost from './WalkthroughHost';
import type { Step } from './types';

const step: Step = {
  id: 'move-mission',
  banner: {
    title: 'Move the mission request',
    body: 'Drag Mission Alpha to a new slot.',
  },
  spotlight: { eventId: 'wt-mission' },
  matches: () => false,
};

describe('WalkthroughHost smoke', () => {
  it('injects spotlight CSS without overriding event positioning', () => {
    const { container } = render(
      <WalkthroughHost
        step={step}
        state={{ mode: 'guided', currentStep: step.id, history: [], bootstrapping: false }}
        steps={[step]}
        onAdvance={vi.fn()}
        onRestart={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { hidden: true })).toBeInTheDocument();

    const styleTag = container.querySelector('style');
    expect(styleTag?.textContent).toContain('[data-wc-event-id="wt-mission"]');
    expect(styleTag?.textContent).toContain('outline: 3px solid #f59e0b;');
    expect(styleTag?.textContent).not.toMatch(/\bposition\s*:/i);
    expect(styleTag?.textContent).not.toMatch(/\bz-index\s*:/i);
  });
});
