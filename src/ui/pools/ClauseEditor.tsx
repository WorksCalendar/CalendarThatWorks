/**
 * ClauseEditor — recursive editor for a single `ResourceQuery` node
 * (issue #386 Level 3 advanced rules).
 *
 * Renders an op picker plus the inputs appropriate to whichever op
 * is active. Composite ops (`and` / `or` / `not`) render their
 * children recursively with add / remove controls.
 *
 * Pure / controlled — takes a clause and an `onChange(next)` callback.
 * The component owns no state of its own; the parent (typically
 * `AdvancedRulesEditor`) holds the tree.
 *
 * Out of scope deliberately: path autocomplete from live resources,
 * drag-drop reordering of composite children, depth-line nesting
 * visuals. Those land in follow-up slices once this primitive is
 * stable.
 */
import type { ChangeEvent } from 'react'
import type {
  ResourceQuery, ResourceQueryValue, DistanceFrom,
} from '../../core/pools/poolQuerySchema'
import styles from './ClauseEditor.module.css'

export interface ClauseEditorProps {
  readonly clause: ResourceQuery
  readonly onChange: (next: ResourceQuery) => void
  /** Hide the op picker (used by the not-clause sub-renderer). */
  readonly hideOpPicker?: boolean
  /**
   * Recursion depth; bounds for visual indentation and a hard cap
   * at 5 to keep the DOM bounded. The hard cap can be raised once
   * the editor has scrollable nesting indicators (follow-up).
   */
  readonly depth?: number
}

const ALL_OPS: readonly { value: ResourceQuery['op']; label: string; group: 'logic' | 'compare' | 'set' | 'geo' }[] = [
  { value: 'and',    label: 'AND (all of)',  group: 'logic' },
  { value: 'or',     label: 'OR (any of)',   group: 'logic' },
  { value: 'not',    label: 'NOT',           group: 'logic' },
  { value: 'eq',     label: '= equals',      group: 'compare' },
  { value: 'neq',    label: '≠ not equal',   group: 'compare' },
  { value: 'gt',     label: '> greater than', group: 'compare' },
  { value: 'gte',    label: '≥ at least',    group: 'compare' },
  { value: 'lt',     label: '< less than',   group: 'compare' },
  { value: 'lte',    label: '≤ at most',     group: 'compare' },
  { value: 'in',     label: 'is one of',     group: 'set' },
  { value: 'exists', label: 'has value',     group: 'set' },
  { value: 'within', label: 'within radius', group: 'geo' },
]

export default function ClauseEditor({
  clause, onChange, hideOpPicker, depth = 0,
}: ClauseEditorProps): JSX.Element {
  // Hard cap to keep nesting from spiralling. The user can lift it by
  // editing JSON externally; the editor just refuses to add more.
  const atDepthCap = depth >= 5

  return (
    <div className={styles['clause']} data-depth={depth} data-op={clause.op}>
      {!hideOpPicker && (
        <select
          className={styles['opPicker']}
          value={clause.op}
          aria-label="Operation"
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            onChange(reshapeForOp(clause, e.target.value as ResourceQuery['op']))
          }
        >
          <optgroup label="Logic">
            {ALL_OPS.filter(o => o.group === 'logic').map(o =>
              <option key={o.value} value={o.value}>{o.label}</option>)}
          </optgroup>
          <optgroup label="Compare">
            {ALL_OPS.filter(o => o.group === 'compare').map(o =>
              <option key={o.value} value={o.value}>{o.label}</option>)}
          </optgroup>
          <optgroup label="Set">
            {ALL_OPS.filter(o => o.group === 'set').map(o =>
              <option key={o.value} value={o.value}>{o.label}</option>)}
          </optgroup>
          <optgroup label="Geo">
            {ALL_OPS.filter(o => o.group === 'geo').map(o =>
              <option key={o.value} value={o.value}>{o.label}</option>)}
          </optgroup>
        </select>
      )}

      {(clause.op === 'and' || clause.op === 'or') && (
        <CompositeBody clause={clause} onChange={onChange} depth={depth} atCap={atDepthCap} />
      )}

      {clause.op === 'not' && (
        <NotBody clause={clause} onChange={onChange} depth={depth} />
      )}

      {(clause.op === 'eq' || clause.op === 'neq') && (
        <EqBody clause={clause} onChange={onChange} />
      )}

      {(clause.op === 'gt' || clause.op === 'gte' || clause.op === 'lt' || clause.op === 'lte') && (
        <NumericBody clause={clause} onChange={onChange} />
      )}

      {clause.op === 'in' && (
        <InBody clause={clause} onChange={onChange} />
      )}

      {clause.op === 'exists' && (
        <ExistsBody clause={clause} onChange={onChange} />
      )}

      {clause.op === 'within' && (
        <WithinBody clause={clause} onChange={onChange} />
      )}
    </div>
  )
}

// ─── Bodies ────────────────────────────────────────────────────────────────

function CompositeBody({
  clause, onChange, depth, atCap,
}: {
  clause: Extract<ResourceQuery, { op: 'and' | 'or' }>
  onChange: (next: ResourceQuery) => void
  depth: number
  atCap: boolean
}): JSX.Element {
  return (
    <div className={styles['composite']}>
      {clause.clauses.length === 0 && (
        <span className={styles['empty']}>
          {clause.op === 'and' ? 'No sub-rules (matches everything)' : 'No sub-rules (matches nothing)'}
        </span>
      )}
      <ul className={styles['childList']}>
        {clause.clauses.map((c, i) => (
          <li key={i} className={styles['child']}>
            <ClauseEditor
              clause={c}
              depth={depth + 1}
              onChange={(next) => onChange({
                ...clause,
                clauses: clause.clauses.map((existing, j) => j === i ? next : existing),
              })}
            />
            <button
              type="button"
              className={styles['removeBtn']}
              aria-label={`Remove sub-rule ${i + 1}`}
              onClick={() => onChange({
                ...clause,
                clauses: clause.clauses.filter((_, j) => j !== i),
              })}
            >×</button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={styles['addBtn']}
        disabled={atCap}
        title={atCap ? 'Maximum nesting depth reached' : ''}
        onClick={() => onChange({
          ...clause,
          clauses: [...clause.clauses, defaultClause('eq')],
        })}
      >+ Add sub-rule</button>
    </div>
  )
}

function NotBody({
  clause, onChange, depth,
}: {
  clause: Extract<ResourceQuery, { op: 'not' }>
  onChange: (next: ResourceQuery) => void
  depth: number
}): JSX.Element {
  return (
    <div className={styles['notBody']}>
      <ClauseEditor
        clause={clause.clause}
        depth={depth + 1}
        onChange={(inner) => onChange({ ...clause, clause: inner })}
      />
    </div>
  )
}

function EqBody({
  clause, onChange,
}: {
  clause: Extract<ResourceQuery, { op: 'eq' | 'neq' }>
  onChange: (next: ResourceQuery) => void
}): JSX.Element {
  return (
    <div className={styles['leafBody']}>
      <PathInput value={clause.path} onChange={(path) => onChange({ ...clause, path })} />
      <ValueInput
        value={clause.value}
        onChange={(value) => onChange({ ...clause, value })}
      />
    </div>
  )
}

function NumericBody({
  clause, onChange,
}: {
  clause: Extract<ResourceQuery, { op: 'gt' | 'gte' | 'lt' | 'lte' }>
  onChange: (next: ResourceQuery) => void
}): JSX.Element {
  return (
    <div className={styles['leafBody']}>
      <PathInput value={clause.path} onChange={(path) => onChange({ ...clause, path })} />
      <input
        type="number"
        className={styles['numInput']}
        value={Number.isFinite(clause.value) ? clause.value : 0}
        aria-label="Value"
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onChange({ ...clause, value: Number(e.target.value) })}
      />
    </div>
  )
}

function InBody({
  clause, onChange,
}: {
  clause: Extract<ResourceQuery, { op: 'in' }>
  onChange: (next: ResourceQuery) => void
}): JSX.Element {
  return (
    <div className={styles['leafBody']}>
      <PathInput value={clause.path} onChange={(path) => onChange({ ...clause, path })} />
      <input
        type="text"
        className={styles['valuesInput']}
        value={clause.values.join(', ')}
        placeholder="comma-separated"
        aria-label="Values (comma-separated)"
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onChange({
            ...clause,
            values: parseCommaList(e.target.value),
          })}
      />
    </div>
  )
}

function ExistsBody({
  clause, onChange,
}: {
  clause: Extract<ResourceQuery, { op: 'exists' }>
  onChange: (next: ResourceQuery) => void
}): JSX.Element {
  return (
    <div className={styles['leafBody']}>
      <PathInput value={clause.path} onChange={(path) => onChange({ ...clause, path })} />
    </div>
  )
}

function WithinBody({
  clause, onChange,
}: {
  clause: Extract<ResourceQuery, { op: 'within' }>
  onChange: (next: ResourceQuery) => void
}): JSX.Element {
  const fromKind = clause.from.kind
  const usingMiles = clause.km == null
  return (
    <div className={styles['leafBody']}>
      <PathInput value={clause.path} onChange={(path) => onChange({ ...clause, path })} />
      <select
        className={styles['fromKindPicker']}
        value={fromKind}
        aria-label="Reference point"
        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
          const kind = e.target.value as DistanceFrom['kind']
          const next: DistanceFrom = kind === 'point'
            ? { kind: 'point', lat: 0, lon: 0 }
            : { kind: 'proposed' }
          onChange({ ...clause, from: next })
        }}
      >
        <option value="proposed">event location</option>
        <option value="point">fixed point</option>
      </select>
      {fromKind === 'point' && (
        <span className={styles['latLonRow']}>
          <input
            type="number"
            step="any"
            className={styles['numInput']}
            value={clause.from.kind === 'point' ? clause.from.lat : 0}
            aria-label="Latitude"
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({
              ...clause,
              from: { kind: 'point',
                lat: Number(e.target.value),
                lon: clause.from.kind === 'point' ? clause.from.lon : 0 },
            })}
          />
          <input
            type="number"
            step="any"
            className={styles['numInput']}
            value={clause.from.kind === 'point' ? clause.from.lon : 0}
            aria-label="Longitude"
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({
              ...clause,
              from: { kind: 'point',
                lat: clause.from.kind === 'point' ? clause.from.lat : 0,
                lon: Number(e.target.value) },
            })}
          />
        </span>
      )}
      <input
        type="number"
        min={0}
        className={styles['numInput']}
        value={(usingMiles ? clause.miles : clause.km) ?? ''}
        aria-label="Radius"
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onChange(setWithinRadius(clause, usingMiles, e.target.value === '' ? undefined : Number(e.target.value)))
        }
      />
      <select
        className={styles['unitPicker']}
        value={usingMiles ? 'mi' : 'km'}
        aria-label="Unit"
        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
          onChange(setWithinUnit(clause, e.target.value === 'mi'))
        }
      >
        <option value="mi">miles</option>
        <option value="km">km</option>
      </select>
    </div>
  )
}

// ─── Shared inputs ─────────────────────────────────────────────────────────

function PathInput({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  return (
    <input
      type="text"
      className={styles['pathInput']}
      value={value}
      placeholder="meta.capabilities.refrigerated"
      aria-label="Field path"
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
    />
  )
}

function ValueInput({
  value, onChange,
}: { value: ResourceQueryValue; onChange: (v: ResourceQueryValue) => void }): JSX.Element {
  // Type picker so the user can pick string / number / boolean / null
  // explicitly — comparators behave very differently for `'80000'`
  // vs `80000`, so we don't infer.
  const kind: 'string' | 'number' | 'boolean' | 'null' =
    value === null ? 'null'
    : typeof value === 'number' ? 'number'
    : typeof value === 'boolean' ? 'boolean'
    : 'string'
  return (
    <span className={styles['valueRow']}>
      <select
        className={styles['valueKind']}
        value={kind}
        aria-label="Value type"
        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
          switch (e.target.value) {
            case 'string':  onChange(typeof value === 'string' ? value : String(value ?? '')); break
            case 'number':  onChange(typeof value === 'number' ? value : 0); break
            case 'boolean': onChange(value === true); break
            case 'null':    onChange(null); break
          }
        }}
      >
        <option value="string">text</option>
        <option value="number">number</option>
        <option value="boolean">true/false</option>
        <option value="null">null</option>
      </select>
      {kind === 'string' && (
        <input
          type="text"
          className={styles['valueInput']}
          value={String(value ?? '')}
          aria-label="Value"
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        />
      )}
      {kind === 'number' && (
        <input
          type="number"
          className={styles['numInput']}
          value={typeof value === 'number' ? value : 0}
          aria-label="Value"
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
        />
      )}
      {kind === 'boolean' && (
        <select
          className={styles['valueKind']}
          value={value === true ? 'true' : 'false'}
          aria-label="Value"
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value === 'true')}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      )}
      {kind === 'null' && <span className={styles['nullPlaceholder']}>(null)</span>}
    </span>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * When the user picks a different op from the dropdown, fold the
 * existing clause's `path` into the new shape if applicable; default
 * everything else. This keeps the user's typed path from disappearing
 * each time they tweak the comparator.
 */
function reshapeForOp(prev: ResourceQuery, op: ResourceQuery['op']): ResourceQuery {
  const path = 'path' in prev ? prev.path : ''
  switch (op) {
    case 'and':    return { op: 'and',    clauses: 'clauses' in prev ? prev.clauses : [] }
    case 'or':     return { op: 'or',     clauses: 'clauses' in prev ? prev.clauses : [] }
    case 'not':    return { op: 'not',    clause: 'clause' in prev ? prev.clause : defaultClause('eq') }
    case 'eq':     return { op: 'eq',     path, value: 'value' in prev ? prev.value as ResourceQueryValue : '' }
    case 'neq':    return { op: 'neq',    path, value: 'value' in prev ? prev.value as ResourceQueryValue : '' }
    case 'gt':     return { op: 'gt',     path, value: numericFrom(prev) }
    case 'gte':    return { op: 'gte',    path, value: numericFrom(prev) }
    case 'lt':     return { op: 'lt',     path, value: numericFrom(prev) }
    case 'lte':    return { op: 'lte',    path, value: numericFrom(prev) }
    case 'in':     return { op: 'in',     path, values: 'values' in prev ? prev.values : [] }
    case 'exists': return { op: 'exists', path }
    case 'within': return {
      op: 'within', path: path || 'meta.location',
      from: { kind: 'proposed' },
      miles: 50,
    }
  }
}

function defaultClause(op: ResourceQuery['op']): ResourceQuery {
  return reshapeForOp({ op: 'eq', path: '', value: '' } as ResourceQuery, op)
}

function numericFrom(prev: ResourceQuery): number {
  if ('value' in prev && typeof prev.value === 'number') return prev.value
  return 0
}

/**
 * Rebuild a `within` clause with the chosen radius set on exactly
 * one unit field. Spreading `{ miles, km: undefined }` leaks an
 * explicit `undefined` into the object, which TypeScript treats
 * differently from the field being absent — so we construct the
 * result without the unwanted property.
 */
function setWithinRadius(
  clause: Extract<ResourceQuery, { op: 'within' }>,
  usingMiles: boolean,
  value: number | undefined,
): ResourceQuery {
  const base = { op: 'within', path: clause.path, from: clause.from } as const
  return value === undefined
    ? base
    : usingMiles
      ? { ...base, miles: value }
      : { ...base, km: value }
}

function setWithinUnit(
  clause: Extract<ResourceQuery, { op: 'within' }>,
  toMiles: boolean,
): ResourceQuery {
  const cur = clause.miles ?? clause.km
  const base = { op: 'within', path: clause.path, from: clause.from } as const
  if (cur === undefined) return base
  return toMiles ? { ...base, miles: cur } : { ...base, km: cur }
}

function parseCommaList(raw: string): readonly ResourceQueryValue[] {
  return raw.split(',').map(s => s.trim()).filter(s => s.length > 0).map((s) => {
    if (s === 'true')  return true
    if (s === 'false') return false
    if (s === 'null')  return null
    const n = Number(s)
    if (!Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(s)) return n
    return s
  })
}
