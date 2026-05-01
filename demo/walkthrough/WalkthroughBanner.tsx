/**
 * demo/walkthrough/WalkthroughBanner.tsx — the floating step banner.
 *
 * Pure presentation. Reads the active Step + state from props and emits
 * advance/restart/exit clicks back up. Doesn't know about callbacks or
 * the calendar — just shows what's happening and offers a way out.
 */

import type { Step, WalkthroughState } from './types';
import styles from './Walkthrough.module.css';

interface WalkthroughBannerProps {
  step: Step;
  state: WalkthroughState;
  /** Position of the active step in the visible step list (1-based). Pass 0
   *  to suppress the "Step N of M" eyebrow (e.g. on the terminal step). */
  stepIndex: number;
  totalSteps: number;
  onAdvance: () => void;
  onRestart: () => void;
  onExit: () => void;
}

export default function WalkthroughBanner({
  step,
  state,
  stepIndex,
  totalSteps,
  onAdvance,
  onRestart,
  onExit,
}: WalkthroughBannerProps) {
  if (state.mode === 'free-play') return null;

  const isDone = step.id === 'done';

  return (
    <div className={styles['banner']} role="dialog" aria-live="polite" aria-label="Guided walkthrough">
      <div className={styles['bannerHeader']}>
        {!isDone && stepIndex > 0 && (
          <span className={styles['progress']}>
            Step {stepIndex} of {totalSteps}
          </span>
        )}
        <button
          type="button"
          className={styles['dismiss']}
          onClick={onExit}
          aria-label="Exit guided tour"
          title="Exit guided tour"
        >
          ×
        </button>
      </div>
      <h2 className={styles['title']}>{step.banner.title}</h2>
      <p className={styles['body']}>{step.banner.body}</p>
      {!isDone && step.hint && <p className={styles['hint']}>Tip: {step.hint}</p>}
      <div className={styles['controls']}>
        {isDone ? (
          <>
            <button type="button" className={styles['button']} onClick={onExit}>
              Free play
            </button>
            <button type="button" className={`${styles['button']} ${styles['primary']}`} onClick={onRestart}>
              Restart tour
            </button>
          </>
        ) : (
          <>
            {/* Distinct labels so users don't conflate exiting the entire tour
             *  with advancing past one step. */}
            <button type="button" className={styles['button']} onClick={onExit}>
              Exit tour
            </button>
            <button type="button" className={styles['button']} onClick={onAdvance}>
              Skip this step
            </button>
          </>
        )}
      </div>
    </div>
  );
}
