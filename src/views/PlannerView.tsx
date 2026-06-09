/**
 * PlannerView — resource allocation + live conflict check.
 *
 * A clean two-column scheduler surface adapted from an "ops planner" layout:
 *   - LEFT  — what the job needs + the resource pool to draw from
 *             (parameters, segments, capability requirements, resource list
 *             with availability / time-until-maintenance / booking status).
 *   - RIGHT — the resulting allocation + whether it's legal
 *             (operator rotation, crew + duty-day check, conflicts, actions).
 *
 * Deliberately domain-agnostic: every noun is a label, not a hard-coded
 * aviation/medical term. The component carries demo data so it renders
 * standalone; hosts override via props. This is the presentational scaffold —
 * a later pass wires it to the real pool / requirement / conflict-engine /
 * duty-time plumbing.
 *
 * Owns its chrome (like the dispatch board): the host hands over the full
 * pane and passes a `viewSwitcher` node to slot into the header. No demo
 * banner, no brand gradient — themed with the calendar's neutral surface.
 */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Boxes, Plus, TriangleAlert, Clock, CircleCheck, ChevronDown, Send, FileText,
} from 'lucide-react';
import '../styles/tailwind.css';

// ─── Agnostic data model ────────────────────────────────────────────────────

export type PlannerResourceStatus = 'available' | 'booked' | 'maintenance';

export interface PlannerResource {
  readonly id: string;
  /** Type / model line shown next to the id. */
  readonly name: string;
  /** Secondary qualifier (class, region, restriction). */
  readonly group?: string;
  readonly status: PlannerResourceStatus;
  /** Service life remaining before the next required maintenance, in hours.
   *  `null` when not tracked. Drives the green/amber countdown. */
  readonly hoursUntilService?: number | null;
  /** Why a `booked` resource is unavailable — shown as a hover tooltip. */
  readonly bookedReason?: string;
}

/** Per-segment duty state for an operator. */
export type PlannerDutyState = 'on' | 'rest';

export interface PlannerOperator {
  readonly id: string;
  readonly name: string;
  /** One entry per segment — whether this operator works it or rests. */
  readonly segments: readonly PlannerDutyState[];
}

export interface PlannerCrewMember {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly source?: string;
}

export interface PlannerSegment {
  readonly id: string;
  readonly label: string;
  readonly hours: number;
}

export interface PlannerLabels {
  title: string;
  subtitle: string;
  segmentsLabel: string;
  resourcesLabel: string;
  operatorsLabel: string;
  crewLabel: string;
  /** Hard cap on the duty day, in hours — exceeding it raises a conflict. */
  dutyLimitHours: number;
}

export interface PlannerViewProps {
  /** View-switcher tabs to render inline in the header (chrome-owning view). */
  readonly viewSwitcher?: ReactNode;
  readonly resources?: readonly PlannerResource[];
  readonly operators?: readonly PlannerOperator[];
  readonly crew?: readonly PlannerCrewMember[];
  readonly segments?: readonly PlannerSegment[];
  readonly capabilities?: readonly string[];
  readonly labels?: Partial<PlannerLabels>;
}

// ─── Demo fallback data (agnostic) ──────────────────────────────────────────

const DEMO_RESOURCES: PlannerResource[] = [
  { id: 'UNIT-12', name: 'Class A', group: 'Unrestricted', status: 'available',   hoursUntilService: 312 },
  { id: 'UNIT-07', name: 'Class B', group: 'Regional',     status: 'booked',      hoursUntilService: 188, bookedReason: 'In use — Job #4821 · Region North (today)' },
  { id: 'UNIT-21', name: 'Class B', group: 'Regional',     status: 'available',   hoursUntilService: 245 },
  { id: 'UNIT-04', name: 'Class C', group: 'Local',        status: 'booked',      hoursUntilService: 96,  bookedReason: 'In use — Job #4799 · Region South (today)' },
  { id: 'UNIT-31', name: 'Class C', group: 'Local',        status: 'available',   hoursUntilService: 67 },
  { id: 'UNIT-18', name: 'Class C', group: 'Local',        status: 'available',   hoursUntilService: 203 },
  { id: 'UNIT-09', name: 'Class C', group: 'Local',        status: 'maintenance', hoursUntilService: null },
  { id: 'UNIT-26', name: 'Class D', group: 'Local',        status: 'available',   hoursUntilService: 112 },
];

const DEMO_OPERATORS: PlannerOperator[] = [
  { id: 'op1', name: 'A. Alvey',   segments: ['on'] },
  { id: 'op2', name: 'B. Halbert', segments: ['on'] },
  { id: 'op3', name: 'C. Mecham',  segments: ['rest'] },
  { id: 'op4', name: 'D. Bailey',  segments: ['rest'] },
];

const DEMO_CREW: PlannerCrewMember[] = [
  { id: 'c1', name: 'Y. Liljenquist', role: 'Lead',     source: 'Team A' },
  { id: 'c2', name: 'H. Van',         role: 'Support',  source: 'Team A' },
];

const DEMO_SEGMENTS: PlannerSegment[] = [
  { id: 'S1', label: 'Segment 1', hours: 3 },
];

const DEMO_CAPABILITIES = [
  'Hazmat', 'Heavy Lift', 'Cold Chain', 'Oversize', 'Escort', 'Night Ops', 'Long Haul',
];

const DEFAULT_LABELS: PlannerLabels = {
  title: 'Resource Planner',
  subtitle: 'Allocate resources & check conflicts',
  segmentsLabel: 'Segments',
  resourcesLabel: 'Resources',
  operatorsLabel: 'Operator Rotation',
  crewLabel: 'Crew',
  dutyLimitHours: 10,
};

// ─── Small presentational helpers ───────────────────────────────────────────

function Card({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Segmented({ options, value, onChange }: {
  options: readonly string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-md overflow-hidden border border-neutral-700">
      {options.map((opt, i) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={[
            'flex-1 py-1.5 text-[11px] font-medium transition-colors',
            i > 0 ? 'border-l border-neutral-700' : '',
            value === opt ? 'bg-sky-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700',
          ].filter(Boolean).join(' ')}
        >{opt}</button>
      ))}
    </div>
  );
}

function serviceColor(hours: number | null | undefined): string {
  if (hours == null) return 'text-neutral-600';
  if (hours <= 100) return 'text-amber-400';
  return 'text-green-400';
}

// ─── Main view ──────────────────────────────────────────────────────────────

export default function PlannerView({
  viewSwitcher,
  resources = DEMO_RESOURCES,
  operators = DEMO_OPERATORS,
  crew = DEMO_CREW,
  segments: segmentsProp = DEMO_SEGMENTS,
  capabilities = DEMO_CAPABILITIES,
  labels: labelsProp,
}: PlannerViewProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };

  const [scope, setScope] = useState('Local');
  const [priority, setPriority] = useState('Routine');
  const [segments, setSegments] = useState<PlannerSegment[]>(() => [...segmentsProp]);
  const [selectedCaps, setSelectedCaps] = useState<Set<string>>(new Set());
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [benched, setBenched] = useState<Set<string>>(new Set());

  const totalHours = useMemo(() => segments.reduce((s, seg) => s + seg.hours, 0), [segments]);
  // Estimated duty = flight/work hours + fixed turnaround per segment.
  const dutyHours = useMemo(() => totalHours + segments.length * 0.7, [totalHours, segments.length]);
  const overDuty = dutyHours > labels.dutyLimitHours;

  // Live conflicts — the heart of the layout: warnings appear the moment the
  // plan becomes illegal (nothing allocated, or duty day blown).
  const conflicts = useMemo(() => {
    const out: { kind: 'warn' | 'error'; text: string }[] = [];
    if (!selectedResource) out.push({ kind: 'warn', text: 'No resource selected.' });
    if (overDuty) out.push({
      kind: 'error',
      text: `Duty day ${dutyHours.toFixed(1)} hrs exceeds the ${labels.dutyLimitHours} hr limit.`,
    });
    return out;
  }, [selectedResource, overDuty, dutyHours, labels.dutyLimitHours]);

  const hasError = conflicts.some(c => c.kind === 'error');
  const canAllocate = selectedResource != null && !hasError;

  const addSegment = () => setSegments(s => [
    ...s, { id: `S${s.length + 1}`, label: `Segment ${s.length + 1}`, hours: 2 },
  ]);
  const setSegmentHours = (id: string, hours: number) =>
    setSegments(s => s.map(seg => (seg.id === id ? { ...seg, hours } : seg)));
  const toggleCap = (cap: string) => setSelectedCaps(prev => {
    const next = new Set(prev);
    if (next.has(cap)) next.delete(cap); else next.add(cap);
    return next;
  });
  const toggleBench = (id: string) => setBenched(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const dutyStartLabel = '07:00';
  const dutyEnd = useMemo(() => {
    const end = 7 + dutyHours;
    const h = Math.floor(end);
    const m = Math.round((end - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }, [dutyHours]);

  return (
    <div className="h-full flex flex-col bg-neutral-950 text-neutral-100 overflow-hidden">
      {/* Header — title + inline view switcher (no demo banner, no gradient) */}
      <div className="shrink-0 border-b border-neutral-800 bg-neutral-900/60 px-4 sm:px-7 py-3 flex items-center gap-4">
        <div className="w-9 h-9 rounded-md bg-sky-500/20 border border-sky-500/30 flex items-center justify-center shrink-0">
          <Boxes className="text-sky-400" size={16} />
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold leading-tight truncate">{labels.title}</div>
          <div className="text-[11px] text-neutral-500 truncate">{labels.subtitle}</div>
        </div>
        <div className="flex-1" />
        {viewSwitcher}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="px-4 sm:px-7 pt-4 pb-8 max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">

            {/* LEFT — requirements + resource pool */}
            <div className="space-y-4">
              <Card title="Parameters">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">Scope</div>
                    <Segmented options={['Local', 'Regional']} value={scope} onChange={setScope} />
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">Priority</div>
                    <Segmented options={['Routine', 'Urgent']} value={priority} onChange={setPriority} />
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">Start Date</div>
                    <input
                      type="date"
                      defaultValue="2026-05-18"
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-3 py-1.5 text-[12px] text-neutral-200 outline-none focus:border-sky-500/50"
                    />
                  </div>
                </div>
              </Card>

              <Card
                title={`${labels.segmentsLabel} — ${segments.length} · ${totalHours.toFixed(1)} hrs`}
                right={
                  <button onClick={addSegment} className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300">
                    <Plus size={12} />Add {labels.segmentsLabel.replace(/s$/, '')}
                  </button>
                }
              >
                <div className="space-y-2">
                  {segments.map((seg, i) => (
                    <div key={seg.id} className="flex items-center gap-2 bg-neutral-800/50 border border-neutral-800 rounded-md px-3 py-2">
                      <span className="mono text-[10px] text-neutral-500 w-7 shrink-0">{`S${i + 1}`}</span>
                      <input
                        placeholder="Destination / label"
                        className="flex-1 bg-transparent text-[12px] text-neutral-200 placeholder-neutral-600 outline-none min-w-0"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number" min={0.5} max={14} step={0.5} value={seg.hours}
                          onChange={e => setSegmentHours(seg.id, Number(e.target.value))}
                          className="w-14 bg-neutral-800 border border-neutral-700 rounded px-2 py-0.5 text-[12px] text-neutral-200 outline-none text-right"
                        />
                        <span className="text-[10px] text-neutral-500">hrs</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-neutral-600">
                  Estimated duty: <span className={overDuty ? 'font-semibold text-amber-400' : 'font-semibold text-neutral-300'}>{dutyHours.toFixed(1)} hrs</span>
                  <span className="text-neutral-500"> (limit {labels.dutyLimitHours} hrs)</span>
                </div>
              </Card>

              <Card title="Capability Requirements">
                <div className="flex flex-wrap gap-2">
                  {capabilities.map(cap => {
                    const on = selectedCaps.has(cap);
                    return (
                      <button
                        key={cap}
                        onClick={() => toggleCap(cap)}
                        className={[
                          'px-2.5 py-1 rounded border text-[11px] font-medium transition-colors',
                          on
                            ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                            : 'bg-neutral-800/50 border-neutral-700 text-neutral-400 hover:border-neutral-600',
                        ].join(' ')}
                      >{cap}</button>
                    );
                  })}
                </div>
              </Card>

              <Card title={labels.resourcesLabel} right={<span className="text-[10px] text-neutral-500">Select for this job</span>}>
                <div className="space-y-1.5">
                  {resources.map(r => {
                    const disabled = r.status !== 'available';
                    const selected = selectedResource === r.id;
                    const badge =
                      r.status === 'maintenance'
                        ? { text: 'MX', cls: 'bg-neutral-700/30 border-neutral-600/30 text-neutral-500' }
                        : r.status === 'booked'
                        ? { text: 'BOOKED', cls: 'bg-amber-500/15 border-amber-500/25 text-amber-300' }
                        : { text: 'OK', cls: 'bg-green-500/10 border-green-500/20 text-green-400' };
                    return (
                      <button
                        key={r.id}
                        disabled={disabled}
                        title={r.bookedReason}
                        onClick={() => setSelectedResource(selected ? null : r.id)}
                        className={[
                          'w-full flex items-center gap-3 px-3 py-2 rounded-md border text-left transition-colors',
                          selected
                            ? 'bg-sky-500/10 border-sky-500/40'
                            : 'bg-neutral-800/40 border-neutral-800 hover:border-neutral-700',
                          disabled ? 'opacity-50 cursor-not-allowed' : '',
                        ].join(' ')}
                      >
                        <div className={['w-2 h-2 rounded-full shrink-0', selected ? 'bg-sky-400' : 'bg-neutral-700'].join(' ')} />
                        <span className="mono text-[11px] text-neutral-300 w-16 shrink-0">{r.id}</span>
                        <span className="text-[12px] text-neutral-200 flex-1 truncate">{r.name}</span>
                        <span className="text-[10px] text-neutral-500 w-20 shrink-0 text-right truncate">{r.group}</span>
                        <span className={['text-[11px] font-semibold w-20 shrink-0 text-right', serviceColor(r.hoursUntilService)].join(' ')}>
                          {r.status === 'maintenance' ? 'MX' : r.status === 'booked' ? 'IN USE' : `${r.hoursUntilService} hrs`}
                        </span>
                        <span className={['mono text-[9px] px-1.5 py-0.5 rounded border', badge.cls].join(' ')}>{badge.text}</span>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* RIGHT — allocation + legality */}
            <div className="space-y-4">
              <Card
                title={labels.operatorsLabel}
                right={<button className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300"><ChevronDown size={11} />Detail</button>}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-neutral-800">
                        <th className="text-left text-neutral-500 font-normal py-1.5 pr-3">Operator</th>
                        {segments.map((seg, i) => (
                          <th key={seg.id} className="text-center text-neutral-500 font-normal py-1.5 px-1 min-w-[52px]">
                            <div>{`S${i + 1}`}</div>
                            <div className="text-neutral-600 text-[9px]">{seg.hours}h</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {operators.map(op => {
                        const isBenched = benched.has(op.id);
                        return (
                          <tr
                            key={op.id}
                            onClick={() => toggleBench(op.id)}
                            title="Click to bench this operator — allocator picks the next eligible"
                            className="border-b border-neutral-800/50 cursor-pointer transition-colors hover:bg-neutral-800/30"
                          >
                            <td className="py-1.5 pr-3"><div className="text-neutral-200 truncate max-w-[120px]">{op.name}</div></td>
                            {segments.map((_, i) => {
                              const state: PlannerDutyState = isBenched ? 'rest' : (op.segments[i] ?? 'rest');
                              return (
                                <td key={i} className="text-center py-1.5 px-1">
                                  <span className={[
                                    'inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold',
                                    state === 'on' ? 'bg-green-500/15 text-green-300' : 'text-neutral-600 bg-neutral-800/50',
                                  ].join(' ')}>{state === 'on' ? 'ON' : 'REST'}</span>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title={labels.crewLabel}>
                <div className="space-y-1.5">
                  {crew.map(c => (
                    <div key={c.id} title="Click to bench this crew member — allocator picks next eligible"
                      className="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors bg-neutral-800/40 border-neutral-800 hover:bg-neutral-800/60">
                      <CircleCheck className="text-green-400 shrink-0" size={11} />
                      <span className="flex-1 text-[12px] text-neutral-200 truncate">{c.name}</span>
                      <span className="text-[10px] text-neutral-500 shrink-0">{c.role}</span>
                      {c.source && <span className="mono text-[9px] text-neutral-600 shrink-0">{c.source}</span>}
                    </div>
                  ))}
                </div>
                <div className={[
                  'mt-2.5 flex items-center gap-2 px-3 py-2 rounded-md border text-[11px]',
                  overDuty ? 'bg-amber-500/10 border-amber-500/25 text-amber-300' : 'bg-neutral-800/50 border-neutral-800 text-neutral-400',
                ].join(' ')}>
                  <Clock className="shrink-0" size={11} />
                  Duty day <span className="font-semibold mx-1">{dutyStartLabel}–{dutyEnd}</span>· {dutyHours.toFixed(1)} hrs
                  <span className="ml-1">{overDuty ? '— over limit' : '— within limits'}</span>
                </div>
              </Card>

              <Card title={`Conflicts (${conflicts.length})`}>
                {conflicts.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border text-[11px] bg-green-500/10 border-green-500/20 text-green-400">
                    <CircleCheck className="shrink-0" size={13} />No conflicts — ready to allocate.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {conflicts.map((c, i) => (
                      <div key={i} className={[
                        'flex items-start gap-2 px-3 py-2 rounded-md border text-[11px]',
                        c.kind === 'error' ? 'bg-red-500/10 border-red-500/25 text-red-300' : 'bg-amber-500/10 border-amber-500/25 text-amber-300',
                      ].join(' ')}>
                        <TriangleAlert className="shrink-0 mt-0.5" size={13} /><span>{c.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <div className="flex gap-2 pt-1">
                <button
                  disabled={!canAllocate}
                  className={[
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-[12px] font-semibold transition-colors border',
                    canAllocate
                      ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-500'
                      : 'bg-neutral-800 text-neutral-600 cursor-not-allowed border-neutral-700',
                  ].join(' ')}
                >
                  <Send size={13} />Allocate Resources
                </button>
                <button className="px-4 py-2.5 rounded-md border border-neutral-700 text-[12px] text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 transition-colors flex items-center gap-1.5">
                  <FileText size={12} />Save Draft
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
