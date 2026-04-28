/**
 * AdvancedRulesEditor — flat list manager for advanced query
 * clauses (issue #386 Level 3).
 *
 * Each row shows a clause's plain-English summary + a Remove button.
 * Editing a row toggles a `ClauseEditor` inline. New clauses are
 * added via "+ Add rule".
 *
 * Pure / controlled — operates on a `ResourceQuery[]` and emits
 * changes via `onChange`. The parent (`PoolBuilder`) owns the array
 * and AND-merges it with the simple-form clauses on save.
 */
import { useState } from 'react'
import type { ResourceQuery } from '../../core/pools/poolQuerySchema'
import ClauseEditor from './ClauseEditor'
import { summarizeQuery } from './poolSummary'
import styles from './AdvancedRulesEditor.module.css'

export interface AdvancedRulesEditorProps {
  readonly clauses: readonly ResourceQuery[]
  readonly onChange: (next: readonly ResourceQuery[]) => void
}

const DEFAULT_NEW_CLAUSE: ResourceQuery = { op: 'eq', path: '', value: '' }

export default function AdvancedRulesEditor({
  clauses, onChange,
}: AdvancedRulesEditorProps): JSX.Element {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const updateAt = (index: number, next: ResourceQuery) =>
    onChange(clauses.map((c, i) => i === index ? next : c))
  const removeAt = (index: number) => {
    onChange(clauses.filter((_, i) => i !== index))
    if (editingIndex === index) setEditingIndex(null)
  }
  const addNew = () => {
    onChange([...clauses, DEFAULT_NEW_CLAUSE])
    setEditingIndex(clauses.length) // open the new row in edit mode
  }

  return (
    <div className={styles['root']} aria-label="Advanced rules editor">
      {clauses.length === 0 && (
        <p className={styles['empty']}>
          No advanced rules yet. Use these to express AND/OR/NOT logic, numeric
          ranges, fixed-point distances, or any other rule the simple form
          doesn’t cover.
        </p>
      )}
      <ul className={styles['list']}>
        {clauses.map((c, i) => {
          const phrase = summarizeQuery(c).join(' & ') || `${c.op}(...)`
          const isEditing = editingIndex === i
          return (
            <li key={i} className={styles['row']}>
              <div className={styles['rowHead']}>
                <span className={styles['summary']} data-testid={`advanced-rule-summary-${i}`}>
                  {phrase}
                </span>
                <span className={styles['rowActions']}>
                  <button
                    type="button"
                    className={styles['rowBtn']}
                    onClick={() => setEditingIndex(isEditing ? null : i)}
                    aria-expanded={isEditing}
                    aria-controls={`advanced-rule-body-${i}`}
                  >
                    {isEditing ? 'Done' : 'Edit'}
                  </button>
                  <button
                    type="button"
                    className={styles['rowBtn']}
                    onClick={() => removeAt(i)}
                    aria-label={`Remove rule ${i + 1}`}
                  >
                    Remove
                  </button>
                </span>
              </div>
              {isEditing && (
                <div id={`advanced-rule-body-${i}`} className={styles['rowBody']}>
                  <ClauseEditor clause={c} onChange={(next) => updateAt(i, next)} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <button type="button" className={styles['addBtn']} onClick={addNew}>
        + Add rule
      </button>
    </div>
  )
}
