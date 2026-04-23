/**
 * AdvancedFilterBuilder.jsx — Visual AND/OR condition builder for Smart Views.
 *
 * Lets users compose multi-condition filters with explicit AND / OR logic
 * between each row, then save the result as a named Smart View.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { createId } from '../core/createId';
import { DEFAULT_FILTER_SCHEMA, defaultOperatorsForType } from '../filters/filterSchema';
import { conditionsToFilters } from '../filters/conditionEngine';
import type { FilterField, FilterOperator, FilterOption } from '../filters/filterSchema';
import styles from './AdvancedFilterBuilder.module.css';

type ConditionLogic = 'AND' | 'OR';

type BuilderCondition = {
  id: string;
  field: string;
  operator: string;
  value: string;
  logic: ConditionLogic;
};

type AdvancedFilterBuilderProps = {
  schema?: FilterField[];
  items?: unknown[];
  onSave?: (name: string, filters: Record<string, unknown>, conditions: BuilderCondition[]) => void;
  categories?: unknown[];
  resources?: unknown[];
  initialName?: string;
  initialConditions?: unknown[] | null;
  editingId?: string | null;
  onUpdate?: (id: string, name: string, filters: Record<string, unknown>, conditions: BuilderCondition[]) => void;
  onCancelEdit?: () => void;
};

function makeCondition(logic: ConditionLogic = 'AND', firstFieldKey = 'categories'): BuilderCondition {
  return { id: createId('cond'), field: firstFieldKey, operator: 'is', value: '', logic };
}

function toBuilderCondition(input: unknown, fallbackFieldKey: string): BuilderCondition {
  const candidate = (input ?? {}) as Partial<BuilderCondition>;
  const logic: ConditionLogic = candidate.logic === 'OR' ? 'OR' : 'AND';
  return {
    id: createId('cond'),
    field: typeof candidate.field === 'string' ? candidate.field : fallbackFieldKey,
    operator: typeof candidate.operator === 'string' ? candidate.operator : 'is',
    value: typeof candidate.value === 'string' ? candidate.value : '',
    logic,
  };
}

export default function AdvancedFilterBuilder({
  schema = DEFAULT_FILTER_SCHEMA,
  items = [],
  onSave,
  categories = [],
  resources = [],
  initialName = '',
  initialConditions = null,
  editingId = null,
  onUpdate,
  onCancelEdit,
}: AdvancedFilterBuilderProps) {
  void categories;
  void resources;

  const fieldOptions = useMemo(
    () => schema.filter((f) => f.type !== 'date-range'),
    [schema],
  );

  const operatorMap = useMemo<Record<string, FilterOperator[]>>(() => {
    const map: Record<string, FilterOperator[]> = {};
    for (const f of fieldOptions) {
      map[f.key] = f.operators ?? defaultOperatorsForType(f.type);
    }
    return map;
  }, [fieldOptions]);

  const firstFieldKey = fieldOptions[0]?.key ?? 'categories';

  const [conditions, setConditions] = useState<BuilderCondition[]>(() =>
    initialConditions && initialConditions.length > 0
      ? initialConditions.map((c) => toBuilderCondition(c, firstFieldKey))
      : [makeCondition('AND', firstFieldKey)],
  );
  const [viewName, setViewName] = useState(initialName);
  const [nameError, setNameError] = useState('');
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) {
        clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (editingId == null) return;
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [editingId]);

  const addCondition = (logic: ConditionLogic) => {
    setConditions((prev) => [...prev, makeCondition(logic, firstFieldKey)]);
  };

  const updateCondition = (id: string, updates: Partial<BuilderCondition>) => {
    setConditions((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...updates };
        if (updates.field && updates.field !== c.field) {
          next.operator = operatorMap[updates.field]?.[0]?.value ?? 'is';
          next.value = '';
        }
        return next;
      }),
    );
  };

  const removeCondition = (id: string) => {
    setConditions((prev) => (prev.length > 1 ? prev.filter((c) => c.id !== id) : prev));
  };

  const handleSave = () => {
    const name = viewName.trim();
    if (!name) {
      setNameError('Enter a name for this Smart View.');
      return;
    }

    setNameError('');
    const filters = conditionsToFilters(conditions, schema);

    if (editingId && onUpdate) {
      onUpdate(editingId, name, filters, conditions);
      setSaved(true);
      if (savedTimerRef.current !== null) {
        clearTimeout(savedTimerRef.current);
      }
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    } else {
      onSave?.(name, filters, conditions);
      setSaved(true);
      if (savedTimerRef.current !== null) {
        clearTimeout(savedTimerRef.current);
      }
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
      setViewName('');
      setConditions([makeCondition('AND', firstFieldKey)]);
    }
  };

  return (
    <div className={styles.builder} ref={rootRef}>
      <div className={styles.conditions}>
        {conditions.map((cond, index) => {
          const fieldDef = schema.find((f) => f.key === cond.field);
          const options: FilterOption[] | null =
            fieldDef?.options ?? (fieldDef?.getOptions ? fieldDef.getOptions(items) : null);

          return (
            <div key={cond.id} className={styles.conditionWrap}>
              {index > 0 && (
                <div className={styles.logicRow}>
                  {(['AND', 'OR'] as const).map((lbl) => (
                    <button
                      key={lbl}
                      className={[styles.logicBtn, cond.logic === lbl && styles.logicActive].filter(Boolean).join(' ')}
                      onClick={() => updateCondition(cond.id, { logic: lbl })}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.conditionRow}>
                <select
                  className={styles.select}
                  value={cond.field}
                  onChange={(e) => updateCondition(cond.id, { field: e.target.value })}
                  aria-label="Filter field"
                >
                  {fieldOptions.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>

                <select
                  className={styles.select}
                  value={cond.operator}
                  onChange={(e) => updateCondition(cond.id, { operator: e.target.value })}
                  aria-label="Filter operator"
                >
                  {(operatorMap[cond.field] ?? []).map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {options && options.length > 0 ? (
                  <select
                    className={[styles.select, styles.valueSelect].join(' ')}
                    value={cond.value}
                    onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                    aria-label="Filter value"
                  >
                    <option value="">Select…</option>
                    {options.map((opt) => (
                      <option key={String(opt.value)} value={String(opt.value)}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={[styles.input, styles.valueInput].join(' ')}
                    type="text"
                    value={cond.value}
                    onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                    placeholder="Value…"
                    aria-label="Filter value"
                  />
                )}

                <button
                  className={styles.removeBtn}
                  onClick={() => removeCondition(cond.id)}
                  disabled={conditions.length <= 1}
                  aria-label="Remove condition"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.addRow}>
        <button className={styles.addBtn} onClick={() => addCondition('AND')}>
          <Plus size={13} /> AND
        </button>
        <button className={styles.addBtn} onClick={() => addCondition('OR')}>
          <Plus size={13} /> OR
        </button>
      </div>

      <div className={styles.saveSection}>
        <div className={styles.nameField}>
          <label htmlFor="afb-view-name" className={styles.srOnly}>
            Smart View name
          </label>
          <input
            id="afb-view-name"
            ref={nameInputRef}
            className={[styles.input, styles.nameInput, nameError ? styles.inputError : ''].filter(Boolean).join(' ')}
            type="text"
            value={viewName}
            onChange={(e) => {
              setViewName(e.target.value);
              if (nameError) setNameError('');
            }}
            placeholder="Name this Smart View…"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          {nameError && <span className={styles.errorMsg}>{nameError}</span>}
        </div>

        <button
          className={[styles.saveBtn, saved ? styles.saveBtnSaved : ''].filter(Boolean).join(' ')}
          onClick={handleSave}
        >
          {saved ? (
            <>
              <Check size={13} /> Saved!
            </>
          ) : editingId ? (
            'Update Smart View'
          ) : (
            'Save Smart View'
          )}
        </button>

        {editingId && onCancelEdit && (
          <button className={styles.cancelBtn} onClick={onCancelEdit}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
