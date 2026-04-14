import { useEffect, useRef } from 'react';
import styles from './EmployeeActionCard.module.css';

/**
 * EmployeeActionCard — fixed-position popover shown when an employee name is
 * clicked in the TimelineView.
 *
 * Props:
 *   emp        { id, name, role? }   — the employee whose row was clicked
 *   anchorRect DOMRect               — bounding rect of the name cell (for positioning)
 *   onAction   (action) => void      — called with 'pto' | 'unavailable' | 'availability' | 'schedule'
 *   onClose    () => void
 */
export default function EmployeeActionCard({ emp, anchorRect, onAction, onClose }) {
  const cardRef = useRef(null);

  // Close on outside click or Escape
  useEffect(() => {
    function handleMouseDown(e) {
      if (cardRef.current && !cardRef.current.contains(e.target)) onClose();
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Auto-focus first button for keyboard accessibility
  useEffect(() => {
    const firstBtn = cardRef.current?.querySelector('button');
    firstBtn?.focus();
  }, []);

  // Position below the name cell, clamped to viewport
  const top  = anchorRect.bottom + 4;
  const left = anchorRect.left;

  function handleAction(action) {
    onAction(action);
    onClose();
  }

  return (
    <div
      ref={cardRef}
      className={styles.card}
      style={{ top, left }}
      role="dialog"
      aria-modal="true"
      aria-label={`Actions for ${emp.name}`}
    >
      <div className={styles.header}>
        <span className={styles.empName}>{emp.name}</span>
        {emp.role && <span className={styles.empRole}>{emp.role}</span>}
      </div>
      <div className={styles.actions}>
        <button
          className={styles.actionBtn}
          onClick={() => handleAction('schedule')}
        >
          Edit Schedule
        </button>
        <button
          className={styles.actionBtn}
          onClick={() => handleAction('pto')}
        >
          Request PTO
        </button>
        <button
          className={styles.actionBtn}
          onClick={() => handleAction('unavailable')}
        >
          Mark Unavailable
        </button>
        <button
          className={styles.actionBtn}
          onClick={() => handleAction('availability')}
        >
          Edit Availability
        </button>
      </div>
    </div>
  );
}
