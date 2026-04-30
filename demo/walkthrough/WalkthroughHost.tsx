/**
 * demo/walkthrough/WalkthroughHost.tsx — composes banner + spotlight.
 *
 * Renders the WalkthroughBanner and injects a global <style> rule that
 * pulses whichever element matches the current step's spotlight target.
 * Targeting is done via CSS attribute selectors, so the rule survives
 * any React-driven DOM re-rendering of the pill or button.
 *
 * In free-play mode, renders only a small "Restart tour" pill in the
 * corner so users who skipped can opt back in.
 */

import { useMemo } from 'react';
import WalkthroughBanner from './WalkthroughBanner';
import type { Step, StepSpotlight, WalkthroughState } from './types';
import styles from './Walkthrough.module.css';

interface WalkthroughHostProps {
  step: Step;
  state: WalkthroughState;
  steps: readonly Step[];
  onAdvance: () => void;
  onRestart: () => void;
  onExit: () => void;
}

export default function WalkthroughHost({
  step,
  state,
  steps,
  onAdvance,
  onRestart,
  onExit,
}: WalkthroughHostProps) {
  // Visible-step counting: drop the terminal 'done' record so the user sees
  // "Step 1 of 5" rather than "Step 1 of 6".
  const visibleSteps = useMemo(() => steps.filter(s => s.id !== 'done'), [steps]);
  const stepIndex = visibleSteps.findIndex(s => s.id === step.id) + 1;

  const spotlightCss = buildSpotlightCss(step.spotlight);

  if (state.mode === 'free-play') {
    return (
      <button type="button" className={styles['resumePill']} onClick={onRestart}>
        Restart tour
      </button>
    );
  }

  return (
    <>
      {spotlightCss && <style>{spotlightCss}</style>}
      <WalkthroughBanner
        step={step}
        state={state}
        stepIndex={stepIndex}
        totalSteps={visibleSteps.length}
        onAdvance={onAdvance}
        onRestart={onRestart}
        onExit={onExit}
      />
    </>
  );
}

function buildSpotlightCss(spotlight: StepSpotlight | undefined): string | null {
  if (!spotlight) return null;
  const selector = spotlight.eventId
    ? `[data-wc-event-id="${escapeAttr(spotlight.eventId)}"]`
    : spotlight.selector ?? null;
  if (!selector) return null;

  // outline + box-shadow pulse. We deliberately do NOT touch `position` or
  // `z-index` here — Week / Day pills rely on `position: absolute` for their
  // inline top/left/width/height percentages, and overriding that to relative
  // breaks the layout (the pill renders at static flow position, leaving the
  // click area empty so click-to-edit becomes click-to-create-new-event).
  // outline is "outside" the box layout so it doesn't need positioning help.
  return `
    ${selector} {
      outline: 3px solid #f59e0b;
      outline-offset: 2px;
      border-radius: 6px;
      animation: wc-walkthrough-pulse 1.6s ease-in-out infinite;
    }
    @keyframes wc-walkthrough-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55); }
      50%      { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
    }
  `;
}

/** Strip anything that could escape an attribute-value selector. Our seed ids
 *  are alphanumeric+dash, so this is defense-in-depth, not a real threat. */
function escapeAttr(v: string): string {
  return v.replace(/["\\]/g, '');
}
