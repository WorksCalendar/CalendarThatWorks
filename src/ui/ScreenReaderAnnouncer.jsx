/**
 * ScreenReaderAnnouncer — hidden live region for announcing dynamic
 * changes to assistive technology.
 *
 * Usage:
 *   const announcerRef = useRef(null);
 *   <ScreenReaderAnnouncer ref={announcerRef} />
 *
 *   // From any event handler:
 *   announcerRef.current?.announce('Event moved to Monday');
 *   announcerRef.current?.announce('Error: end must be after start', 'assertive');
 *
 * Implementation detail:
 *   Uses two alternating hidden paragraphs.  Toggling between them forces
 *   screen readers to re-read identical messages (some ignore textContent
 *   changes when the text is the same as before).
 */

import { useImperativeHandle, useRef, useState, forwardRef } from 'react';

const styles = {
  // Visually hidden but readable by screen readers.
  // Using clip-path is more reliable than display:none or visibility:hidden.
  srOnly: {
    position:   'absolute',
    width:      '1px',
    height:     '1px',
    padding:    0,
    margin:     '-1px',
    overflow:   'hidden',
    clip:       'rect(0,0,0,0)',
    whiteSpace: 'nowrap',
    border:     0,
  },
};

const ScreenReaderAnnouncer = forwardRef(function ScreenReaderAnnouncer(_, ref) {
  const [slot, setSlot]     = useState(0);
  const [msgs, setMsgs]     = useState(['', '']);
  const timeoutRef          = useRef(null);

  useImperativeHandle(ref, () => ({
    /**
     * @param {string}  message    The text to announce.
     * @param {'polite'|'assertive'} [politeness='polite']
     */
    announce(message, politeness = 'polite') {
      // Clear any pending announcement first.
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // Brief delay lets the browser finish any ongoing rendering before
      // the live region change, improving reliability.
      timeoutRef.current = setTimeout(() => {
        setSlot(prev => {
          const next = 1 - prev;
          setMsgs(m => {
            const copy  = [...m];
            copy[next]  = message;
            copy[prev]  = '';          // clear the inactive slot
            return copy;
          });
          return next;
        });
      }, 50);
    },
  }), []);

  return (
    <div aria-live="polite" aria-atomic="true" style={styles.srOnly}>
      <span>{msgs[0]}</span>
      <span>{msgs[1]}</span>
    </div>
  );
});

export default ScreenReaderAnnouncer;
