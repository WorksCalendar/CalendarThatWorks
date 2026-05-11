// @vitest-environment happy-dom
/**
 * Regression for the first-run wizard default calendar name.
 *
 * `SetupLandingProps.initialName` is intentionally typed `string | undefined`
 * (not just `string`) so that — under `exactOptionalPropertyTypes` — callers
 * can pass `undefined` (e.g. `ownerCfg.config?.title` when no title is set
 * yet) and let the parameter default `'My Calendar'` apply. If `initialName`
 * is narrowed back to `string`, a caller forced to substitute `?? ''` would
 * bypass the default and the wizard would open with a blank name field on
 * first run.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';

import SetupLanding from '../SetupLanding';

function startWizard() {
  fireEvent.click(screen.getByRole('button', { name: /Start setup guide/i }));
}

describe('SetupLanding — initial calendar name default', () => {
  it("defaults to 'My Calendar' when initialName is omitted", () => {
    render(<SetupLanding onFinish={vi.fn()} onSkip={vi.fn()} />);
    startWizard();

    const input = screen.getByLabelText(/Calendar name/i) as HTMLInputElement;
    expect(input.value).toBe('My Calendar');
  });

  it("defaults to 'My Calendar' when initialName is explicitly undefined", () => {
    // This is the WorksCalendar.tsx call path when `ownerCfg.config?.title`
    // is `undefined` (no saved title yet). Under exactOptionalPropertyTypes
    // the prop type must include `| undefined` for this to even compile;
    // the runtime behaviour we assert here is the parameter default kicking in.
    render(<SetupLanding onFinish={vi.fn()} onSkip={vi.fn()} initialName={undefined} />);
    startWizard();

    const input = screen.getByLabelText(/Calendar name/i) as HTMLInputElement;
    expect(input.value).toBe('My Calendar');
  });

  it('uses a saved title when initialName is provided', () => {
    render(<SetupLanding onFinish={vi.fn()} onSkip={vi.fn()} initialName="Kitchen Schedule" />);
    startWizard();

    const input = screen.getByLabelText(/Calendar name/i) as HTMLInputElement;
    expect(input.value).toBe('Kitchen Schedule');
  });
});
