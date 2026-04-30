// @ts-nocheck — demo hover card, follows App.tsx convention
//
// Custom hover card for the Air EMS demo. Replaces the library's default
// HoverCard via WorksCalendar's `renderHoverCard` prop. The default card
// dumps every meta field as `String(v)`, which renders the approvalStage
// object as the literal string "[object Object]". This component:
//
//   - Renders a structured "Approval" section when an event has
//     approvalStage meta — current stage chip, recent history, action
//     buttons appropriate to the stage and gated by the active profile's
//     capability matrix.
//   - Filters approvalStage out of the generic meta dump so it doesn't
//     show twice.
//   - Otherwise mirrors the library hover card's layout (color accent,
//     title, time, category, resource, notes) so the rest of the
//     calendar's events keep their familiar look.

import { useEffect, useRef, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { Anchor, Check, Clock, Pencil, Tag, X } from 'lucide-react';
import type { DemoApprovalCaps } from './profiles';

interface DemoHoverCardProps {
  event: any;
  onClose: () => void;
  onEdit?: ((ev: any) => void) | null;
  onApprovalAction?: (event: any, actionId: string, payload?: any) => void;
  approvalCaps?: DemoApprovalCaps;
  resolveResourceLabel?: (id: string) => string;
}

const STAGE_PRESENTATION: Record<
  string,
  { label: string; chipBg: string; chipBorder: string; chipText: string }
> = {
  requested: {
    label:      'Awaiting approval',
    chipBg:     '#fef3c7',
    chipBorder: '#fde68a',
    chipText:   '#92400e',
  },
  approved: {
    label:      'Approved · awaiting finalize',
    chipBg:     '#dbeafe',
    chipBorder: '#bfdbfe',
    chipText:   '#1e40af',
  },
  finalized: {
    label:      'Finalized',
    chipBg:     '#dcfce7',
    chipBorder: '#bbf7d0',
    chipText:   '#15803d',
  },
  denied: {
    label:      'Denied',
    chipBg:     '#fee2e2',
    chipBorder: '#fecaca',
    chipText:   '#991b1b',
  },
  pending_higher: {
    label:      'Pending higher approval',
    chipBg:     '#fef3c7',
    chipBorder: '#fde68a',
    chipText:   '#92400e',
  },
};

interface StageAction {
  id: 'approve' | 'finalize' | 'deny' | 'revoke';
  label: string;
  capKey: keyof DemoApprovalCaps;
  variant: 'primary' | 'ghost' | 'danger';
}

function actionsForStage(stage: string): StageAction[] {
  switch (stage) {
    case 'requested':
      return [
        { id: 'approve',  label: 'Approve',  capKey: 'canApprove',  variant: 'primary' },
        { id: 'deny',     label: 'Deny',     capKey: 'canDeny',     variant: 'danger'  },
      ];
    case 'approved':
    case 'pending_higher':
      return [
        { id: 'finalize', label: 'Finalize', capKey: 'canFinalize', variant: 'primary' },
        { id: 'deny',     label: 'Deny',     capKey: 'canDeny',     variant: 'danger'  },
        { id: 'revoke',   label: 'Send back', capKey: 'canRevoke',  variant: 'ghost'   },
      ];
    case 'finalized':
      return [
        { id: 'revoke',   label: 'Revoke',   capKey: 'canRevoke',   variant: 'ghost'   },
      ];
    default:
      return [];
  }
}

const ACTION_VARIANT_STYLES: Record<string, React.CSSProperties> = {
  primary: { background: '#c2410c', color: '#fff', border: '1px solid #c2410c' },
  ghost:   { background: '#fff',    color: '#4b5563', border: '1px solid rgba(60, 35, 10, 0.18)' },
  danger:  { background: '#fff',    color: '#b91c1c', border: '1px solid #fecaca' },
};

export default function DemoHoverCard({
  event,
  onClose,
  onEdit,
  onApprovalAction,
  approvalCaps,
  resolveResourceLabel,
}: DemoHoverCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Click-outside + Escape close
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!cardRef.current) return;
      if (!cardRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const start = event.start instanceof Date ? event.start : new Date(event.start);
  const end   = event.end   instanceof Date ? event.end   : new Date(event.end);
  const timeRangeText = event.allDay
    ? 'All day'
    : isSameDay(start, end)
      ? `${format(start, 'MMM d, h:mm a')} – ${format(end, 'h:mm a')}`
      : `${format(start, 'MMM d, h:mm a')} – ${format(end, 'MMM d, h:mm a')}`;

  const approvalStage = event?.meta?.approvalStage;
  const stage: string | undefined = approvalStage?.stage;
  const stageInfo = stage ? STAGE_PRESENTATION[stage] : null;
  const history: Array<{ action: string; at: string; actor?: string }> =
    Array.isArray(approvalStage?.history) ? approvalStage.history : [];

  const actions = stage ? actionsForStage(stage) : [];

  // Skip approvalStage in the generic meta dump — it's rendered structurally above.
  const filteredMetaEntries = event.meta
    ? Object.entries(event.meta).filter(([k]) => k !== 'approvalStage' && k !== 'kind')
    : [];

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Event details: ${event.title}`}
      style={{
        position:     'fixed',
        top:          '50%',
        left:         '50%',
        transform:    'translate(-50%, -50%)',
        width:        360,
        maxWidth:     '92vw',
        maxHeight:    '85vh',
        background:   '#fff',
        border:       '1px solid rgba(60, 35, 10, 0.14)',
        borderRadius: 14,
        boxShadow:    '0 24px 48px -12px rgba(45, 31, 14, 0.25)',
        zIndex:       1000,
        overflow:     'hidden',
        display:      'flex',
        flexDirection:'column',
      }}
    >
      {/* Color accent bar */}
      <div style={{ height: 4, background: event.color ?? '#94a3b8' }} />

      <div style={{ padding: '14px 16px 16px', overflowY: 'auto' }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <h3 style={{
            margin: 0, flex: 1, fontSize: 15, fontWeight: 600, color: '#1f2937', lineHeight: 1.3,
          }}>
            {event.title}
          </h3>
          {onEdit && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(event); }}
              aria-label="Edit event"
              title="Edit"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#6b7280', padding: 4, display: 'flex', alignItems: 'center',
              }}
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6b7280', padding: 4, display: 'flex', alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Approval section — structured replacement for the raw meta dump */}
        {stage && stageInfo && (
          <div style={{
            marginBottom: 14,
            padding: '10px 12px',
            border: `1px solid ${stageInfo.chipBorder}`,
            borderRadius: 10,
            background: '#fffaf3',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8,
            }}>
              <span style={{
                fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: '#9a8a73',
              }}>
                Approval
              </span>
              <span style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
                textTransform: 'uppercase',
                padding: '3px 8px', borderRadius: 4,
                background: stageInfo.chipBg,
                color: stageInfo.chipText,
                border: `1px solid ${stageInfo.chipBorder}`,
              }}>
                {stageInfo.label}
              </span>
            </div>

            {history.length > 0 && (
              <ul style={{
                listStyle: 'none', padding: 0, margin: '0 0 10px',
                display: 'flex', flexDirection: 'column', gap: 4,
                fontSize: 11, color: '#6b7280',
              }}>
                {history.slice(-3).reverse().map((h, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Check size={11} style={{ color: '#15803d', flexShrink: 0 }} aria-hidden="true" />
                    <span style={{ fontWeight: 500, color: '#374151' }}>{h.action}</span>
                    <span>by {h.actor ?? 'demo-user'}</span>
                    <span style={{ marginLeft: 'auto' }}>
                      {h.at ? format(new Date(h.at), 'MMM d, h:mm a') : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {actions.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {actions.map(a => {
                  const allowed = approvalCaps ? approvalCaps[a.capKey] : true;
                  const variantStyle = ACTION_VARIANT_STYLES[a.variant];
                  return (
                    <button
                      key={a.id}
                      type="button"
                      disabled={!allowed || !onApprovalAction}
                      onClick={() => onApprovalAction?.(event, a.id, { actor: 'demo-user' })}
                      title={
                        !allowed
                          ? 'Your role does not have permission for this action'
                          : undefined
                      }
                      style={{
                        ...variantStyle,
                        padding:    '6px 12px',
                        borderRadius: 6,
                        fontSize:   12,
                        fontWeight: 600,
                        cursor:     allowed ? 'pointer' : 'not-allowed',
                        opacity:    allowed ? 1 : 0.45,
                      }}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            )}

            {actions.length === 0 && (
              <div style={{ fontSize: 11.5, color: '#6b7280', fontStyle: 'italic' }}>
                Terminal stage — no further action needed.
              </div>
            )}
          </div>
        )}

        {/* Time */}
        <Field icon={<Clock size={13} />}>
          <span>{timeRangeText}</span>
        </Field>

        {/* Category */}
        {event.category && (
          <Field icon={<Tag size={13} />}>
            <span style={{
              fontSize: 11, padding: '2px 6px', borderRadius: 4,
              background: 'rgba(0,0,0,0.06)', color: '#374151', fontWeight: 500,
            }}>
              {event.category}
            </span>
          </Field>
        )}

        {/* Resource */}
        {event.resource && (
          <Field icon={<Anchor size={13} />}>
            <span>{resolveResourceLabel?.(event.resource) ?? event.resource}</span>
          </Field>
        )}

        {/* Other meta (excludes approvalStage and kind which are handled elsewhere) */}
        {filteredMetaEntries.length > 0 && (
          <div style={{
            marginTop: 12, padding: '8px 10px',
            background: '#f9fafb', borderRadius: 6, fontSize: 11,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {filteredMetaEntries.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 6 }}>
                <span style={{ color: '#6b7280', minWidth: 80 }}>{k}</span>
                <span style={{ color: '#374151' }}>
                  {typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 12.5, color: '#4b5563', marginBottom: 6,
    }}>
      <span style={{ color: '#9ca3af', display: 'flex', alignItems: 'center' }}>{icon}</span>
      {children}
    </div>
  );
}
