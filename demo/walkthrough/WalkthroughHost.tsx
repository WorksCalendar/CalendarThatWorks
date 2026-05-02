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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
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

  // Drag-to-reposition state. `offset` is the delta from the CSS default
  // position (top-center). We use a ref for the drag-start snapshot to avoid
  // stale closure issues in the mousemove handler.
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStart = useRef<{ mouseX: number; mouseY: number; offsetX: number; offsetY: number } | null>(null);
  // Mirrors `offset` state in a ref so the mousemove handler can read the
  // current value without a stale closure.
  const currentOffset = useRef({ x: 0, y: 0 });
  // Ref to the banner DOM node for getBoundingClientRect-based clamping.
  const bannerRef = useRef<HTMLDivElement>(null);

  const handleDragMouseDown = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    // Only left-button drag.
    if (e.button !== 0) return;
    e.preventDefault();
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  }, [offset]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragStart.current) return;

      const proposedX = dragStart.current.offsetX + (e.clientX - dragStart.current.mouseX);
      const proposedY = dragStart.current.offsetY + (e.clientY - dragStart.current.mouseY);

      let clampedX = proposedX;
      let clampedY = proposedY;

      if (bannerRef.current) {
        // Project the banner's current rect to where it would land at the
        // proposed offset, then clamp so it stays fully within the viewport.
        const rect = bannerRef.current.getBoundingClientRect();
        const dx = proposedX - currentOffset.current.x;
        const dy = proposedY - currentOffset.current.y;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const projLeft   = rect.left   + dx;
        const projTop    = rect.top    + dy;
        const projRight  = rect.right  + dx;
        const projBottom = rect.bottom + dy;

        if (projLeft < 0)       clampedX = proposedX - projLeft;
        else if (projRight > vw) clampedX = proposedX - (projRight - vw);

        if (projTop < 0)         clampedY = proposedY - projTop;
        else if (projBottom > vh) clampedY = proposedY - (projBottom - vh);
      }

      currentOffset.current = { x: clampedX, y: clampedY };
      setOffset({ x: clampedX, y: clampedY });
    }
    function onMouseUp() {
      dragStart.current = null;
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Apply offset as a CSS translate on top of the banner's default transform.
  // The banner's CSS sets `transform: translateX(-50%)` for centering; we
  // compose an additional translate so both effects apply.
  const bannerStyle: CSSProperties =
    offset.x !== 0 || offset.y !== 0
      ? { transform: `translateX(calc(-50% + ${offset.x}px)) translateY(${offset.y}px)` }
      : {};

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
        ref={bannerRef}
        step={step}
        state={state}
        stepIndex={stepIndex}
        totalSteps={visibleSteps.length}
        onAdvance={onAdvance}
        onRestart={onRestart}
        onExit={onExit}
        style={bannerStyle}
        dragHandleProps={{ onMouseDown: handleDragMouseDown }}
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
