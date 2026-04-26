/**
 * DispatchView — fleet-readiness table answering "what can I launch right now?"
 *
 * The mission/asset-request modal already validates per-mission fit (pilots
 * with the right certifications, aircraft hours, maintenance status, etc.)
 * but the inverse question — "which assets are available this minute?" —
 * required clicking through every mission first. This view inverts that:
 * a flat readiness table per asset, evaluated against an `asOf` time the
 * dispatcher chooses (defaults to now, retargetable for shift-change
 * pre-staging).
 *
 * Status taxonomy is intentionally generic so the same view works for any
 * deployment, not just air EMS:
 *   - Maintenance — an event with category 'maintenance' overlaps asOf
 *   - Busy        — any other event overlaps asOf for this resource
 *   - Available   — neither
 *
 * Crew Ready is a heuristic: at least one employee at the asset's base is
 * not booked at asOf. Equipment Ready is true unless the asset's own
 * `meta.status === 'maintenance'`. The table surfaces what's missing in
 * a final column so the dispatcher's next move is visible at a glance.
 */
import { useMemo, useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { Wrench, Users, Plane, AlertTriangle, Clock, MapPin } from 'lucide-react';
import styles from './DispatchView.module.css';

type LooseEvent = {
  id?: string | number;
  start?: string | Date;
  end?: string | Date;
  resource?: string | number | null;
  category?: string;
  title?: string;
  meta?: Record<string, unknown> | null | undefined;
};

type Employee = {
  id: string | number;
  name?: string;
  base?: string | null | undefined;
};

type Asset = {
  id: string | number;
  label?: string;
  name?: string;
  meta?: {
    base?: string | null;
    status?: string | null;
    sublabel?: string | null;
    [key: string]: unknown;
  } | null | undefined;
};

type Base = { id: string; name: string };

export type DispatchViewProps = {
  events: LooseEvent[];
  employees: Employee[];
  assets: Asset[];
  bases: Base[];
  locationLabel?: string;
  onEventClick?: (id: string | number) => void;
  /** Default as-of time. Component manages its own state from this seed. */
  initialAsOf?: Date;
};

type Status = 'available' | 'busy' | 'maintenance';

type Row = {
  asset: Asset;
  baseId: string;
  baseName: string;
  status: Status;
  blockingEvent: LooseEvent | null;
  crewReady: boolean;
  equipmentReady: boolean;
  missing: string[];
};

function toDate(value: string | Date | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

function eventCoversAsOf(ev: LooseEvent, asOf: Date): boolean {
  const s = toDate(ev.start);
  const e = toDate(ev.end);
  if (!s || !e) return false;
  return s.getTime() <= asOf.getTime() && e.getTime() >= asOf.getTime();
}

/**
 * Resolve the resource(s) an event applies to. The library's event model
 * uses `resource` (single) and an optional `meta.base` for base-wide events.
 * For dispatch readiness we only care about events bound to a specific
 * resource — base-wide events don't make a specific asset busy.
 */
function eventResourceId(ev: LooseEvent): string | null {
  if (ev.resource == null) return null;
  return String(ev.resource);
}

function isMaintenanceEvent(ev: LooseEvent): boolean {
  const cat = (ev.category ?? '').toLowerCase();
  return cat === 'maintenance' || cat.includes('maintenance');
}

export function computeDispatchRows(
  asOf: Date,
  assets: Asset[],
  employees: Employee[],
  bases: Base[],
  locationLabel: string,
): Row[] {
  // Bucket events by the resource they bind to so each asset/employee
  // lookup is O(1) rather than O(events) per row.
  const baseNameById = new Map<string, string>();
  for (const b of bases) baseNameById.set(String(b.id), b.name);

  const rows: Row[] = [];
  const missingFallback = `${locationLabel} unassigned`;

  for (const asset of assets) {
    const baseId = asset.meta?.base != null ? String(asset.meta.base) : '';
    const baseName = baseId ? (baseNameById.get(baseId) ?? baseId) : missingFallback;
    rows.push({
      asset,
      baseId,
      baseName,
      status: 'available',
      blockingEvent: null,
      crewReady: false,
      equipmentReady: false,
      missing: [],
    });
  }
  return rows;
}

/**
 * Decorate the rows produced by computeDispatchRows with status, crew, and
 * equipment readiness derived from the full event pool. Split out so the
 * skeleton (rows for every asset, ordered) can be unit-tested independently
 * of the readiness pipeline.
 */
export function decorateDispatchRows(
  rows: Row[],
  asOf: Date,
  events: LooseEvent[],
  employees: Employee[],
): Row[] {
  // Index events touching `asOf` by resource for O(1) lookup per row.
  const eventsByResource = new Map<string, LooseEvent[]>();
  for (const ev of events) {
    if (!eventCoversAsOf(ev, asOf)) continue;
    const r = eventResourceId(ev);
    if (!r) continue;
    if (!eventsByResource.has(r)) eventsByResource.set(r, []);
    eventsByResource.get(r)!.push(ev);
  }

  return rows.map(row => {
    const assetId = String(row.asset.id);
    const live = eventsByResource.get(assetId) ?? [];
    const maintEvent = live.find(isMaintenanceEvent) ?? null;
    const otherEvent = live.find(e => !isMaintenanceEvent(e)) ?? null;

    const declaredStatus = row.asset.meta?.status;
    const declaredMaint = typeof declaredStatus === 'string' && declaredStatus.toLowerCase() === 'maintenance';

    let status: Status;
    let blockingEvent: LooseEvent | null = null;
    if (maintEvent || declaredMaint) {
      status = 'maintenance';
      blockingEvent = maintEvent;
    } else if (otherEvent) {
      status = 'busy';
      blockingEvent = otherEvent;
    } else {
      status = 'available';
    }

    // Crew readiness: at least one employee at the asset's base is free at asOf.
    let crewReady = false;
    if (row.baseId) {
      for (const emp of employees) {
        if (String(emp.base ?? '') !== row.baseId) continue;
        const empBookings = eventsByResource.get(String(emp.id));
        if (!empBookings || empBookings.length === 0) {
          crewReady = true;
          break;
        }
      }
    }

    const equipmentReady = status !== 'maintenance';

    const missing: string[] = [];
    if (status === 'maintenance') missing.push('In maintenance');
    if (status === 'busy') {
      const t = otherEvent?.title ?? otherEvent?.category ?? 'booking';
      missing.push(`Busy: ${t}`);
    }
    if (status !== 'maintenance' && !crewReady && row.baseId) {
      missing.push('No crew available at this base');
    }
    if (!row.baseId) missing.push(`No ${row.baseName.toLowerCase()} assigned`);

    return { ...row, status, blockingEvent, crewReady, equipmentReady, missing };
  });
}

function formatDateTimeLocal(d: Date): string {
  // <input type="datetime-local"> wants 'YYYY-MM-DDTHH:mm' in local time.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DispatchView({
  events,
  employees,
  assets,
  bases,
  locationLabel = 'Base',
  onEventClick,
  initialAsOf,
}: DispatchViewProps) {
  const [asOf, setAsOf] = useState<Date>(() => initialAsOf ?? new Date());

  const rows = useMemo(() => {
    const skel = computeDispatchRows(asOf, assets, employees, bases, locationLabel);
    return decorateDispatchRows(skel, asOf, events, employees);
  }, [asOf, assets, employees, bases, events, locationLabel]);

  const summary = useMemo(() => {
    let available = 0, busy = 0, maintenance = 0;
    for (const r of rows) {
      if (r.status === 'available') available++;
      else if (r.status === 'busy') busy++;
      else maintenance++;
    }
    return { available, busy, maintenance };
  }, [rows]);

  const isNow = useMemo(() => Math.abs(Date.now() - asOf.getTime()) < 60_000, [asOf]);

  return (
    <div className={styles['root']} role="region" aria-label="Dispatch readiness">
      <div className={styles['toolbar']}>
        <div className={styles['title']}>
          <span className={styles['titleLabel']}>Dispatch</span>
          <span className={styles['titleHint']}>Who can launch right now?</span>
        </div>

        <div className={styles['asOfBlock']}>
          <label className={styles['asOfLabel']} htmlFor="dispatch-asof">
            <Clock size={13} aria-hidden="true" /> As of
          </label>
          <input
            id="dispatch-asof"
            type="datetime-local"
            className={styles['asOfInput']}
            value={formatDateTimeLocal(asOf)}
            onChange={e => {
              const d = new Date(e.target.value);
              if (isValid(d)) setAsOf(d);
            }}
          />
          <button
            type="button"
            className={[styles['nowBtn'], isNow && styles['nowBtnActive']].filter(Boolean).join(' ')}
            onClick={() => setAsOf(new Date())}
            disabled={isNow}
            title={isNow ? 'Already showing live status' : 'Reset to current time'}
          >
            Now
          </button>
        </div>

        <div className={styles['summary']}>
          <span className={[styles['summaryPill'], styles['summaryAvailable']].join(' ')}>
            {summary.available} Available
          </span>
          <span className={[styles['summaryPill'], styles['summaryBusy']].join(' ')}>
            {summary.busy} Busy
          </span>
          <span className={[styles['summaryPill'], styles['summaryMaintenance']].join(' ')}>
            {summary.maintenance} Maintenance
          </span>
        </div>
      </div>

      <div className={styles['scroll']}>
        {rows.length === 0 ? (
          <div className={styles['emptyState']}>
            <p>No assets configured.</p>
            <p className={styles['emptyHint']}>Add assets in Settings → Assets to populate this board.</p>
          </div>
        ) : (
          <table className={styles['table']} role="grid" aria-label="Asset readiness">
            <thead>
              <tr>
                <th scope="col">{locationLabel}</th>
                <th scope="col">Asset</th>
                <th scope="col">Status</th>
                <th scope="col">Crew</th>
                <th scope="col">Equipment</th>
                <th scope="col">Missing / Note</th>
                <th scope="col" className={styles['actionCol']}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const assetLabel = row.asset.label ?? row.asset.name ?? String(row.asset.id);
                const sublabel = typeof row.asset.meta?.sublabel === 'string' ? row.asset.meta.sublabel : null;
                const blockingId = row.blockingEvent?.id;
                return (
                  <tr key={String(row.asset.id)} data-status={row.status}>
                    <td>{row.baseName}</td>
                    <td>
                      <div className={styles['assetCell']}>
                        <span className={styles['assetName']}>{assetLabel}</span>
                        {sublabel && <span className={styles['assetSub']}>{sublabel}</span>}
                      </div>
                    </td>
                    <td>
                      <span className={[styles['statusPill'], styles[`status_${row.status}`]].join(' ')}>
                        <span className={styles['statusDot']} aria-hidden="true" />
                        {row.status === 'available' ? 'Available'
                          : row.status === 'busy' ? 'Busy'
                          : 'Maintenance'}
                      </span>
                    </td>
                    <td>
                      <ReadinessChip ok={row.crewReady} okIcon={<Users size={12} aria-hidden="true" />} okLabel="Ready" naLabel="—" na={row.status === 'maintenance'} />
                    </td>
                    <td>
                      <ReadinessChip ok={row.equipmentReady} okIcon={<Plane size={12} aria-hidden="true" />} okLabel="Ready" />
                    </td>
                    <td className={styles['missingCell']}>
                      {row.missing.length === 0 ? (
                        <span className={styles['missingNone']}>—</span>
                      ) : (
                        <ul className={styles['missingList']}>
                          {row.missing.map((m, i) => (
                            <li key={i}>
                              {m.startsWith('In maintenance')
                                ? <Wrench size={11} aria-hidden="true" />
                                : <AlertTriangle size={11} aria-hidden="true" />}
                              <span>{m}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className={styles['actionCol']}>
                      <ActionButton
                        row={row}
                        blockingId={blockingId != null ? String(blockingId) : null}
                        onView={onEventClick}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles['footer']}>
        <span>
          <MapPin size={11} aria-hidden="true" />
          {' '}{bases.length} {bases.length === 1 ? locationLabel.toLowerCase() : `${locationLabel.toLowerCase()}s`}
          {' · '}{assets.length} {assets.length === 1 ? 'asset' : 'assets'}
        </span>
        <span>{format(asOf, 'EEE MMM d, h:mm a')}</span>
      </div>
    </div>
  );
}

function ReadinessChip({
  ok,
  okIcon,
  okLabel,
  naLabel,
  na = false,
}: {
  ok: boolean;
  okIcon?: React.ReactNode;
  okLabel: string;
  naLabel?: string;
  na?: boolean;
}) {
  if (na) return <span className={styles['naChip']}>{naLabel ?? '—'}</span>;
  return (
    <span className={[styles['readinessChip'], ok ? styles['readinessOk'] : styles['readinessNo']].join(' ')}>
      {ok ? okIcon : null}
      <span>{ok ? okLabel : 'Missing'}</span>
    </span>
  );
}

function ActionButton({
  row,
  blockingId,
  onView,
}: {
  row: Row;
  blockingId: string | null;
  onView?: ((id: string | number) => void) | undefined;
}) {
  if (row.status === 'maintenance') {
    return blockingId
      ? <button type="button" className={styles['actionBtn']} onClick={() => onView?.(blockingId)}>View work</button>
      : <span className={styles['actionMuted']}>—</span>;
  }
  if (row.status === 'busy') {
    return blockingId
      ? <button type="button" className={styles['actionBtn']} onClick={() => onView?.(blockingId)}>View booking</button>
      : <span className={styles['actionMuted']}>—</span>;
  }
  if (!row.crewReady && row.baseId) {
    return <button type="button" className={[styles['actionBtn'], styles['actionWarn']].join(' ')}>Find crew</button>;
  }
  return <button type="button" className={[styles['actionBtn'], styles['actionPrimary']].join(' ')}>Assign</button>;
}
