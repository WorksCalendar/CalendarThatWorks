// @vitest-environment happy-dom
/**
 * AdvancedRulesEditor — flat list manager (#386 L3).
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom'
import React, { useState } from 'react'

import AdvancedRulesEditor from '../AdvancedRulesEditor'
import type { ResourceQuery } from '../../../core/pools/poolQuerySchema'

function Harness({ initial }: { initial: readonly ResourceQuery[] }) {
  const [clauses, setClauses] = useState<readonly ResourceQuery[]>(initial)
  return (
    <div>
      <AdvancedRulesEditor clauses={clauses} onChange={setClauses} />
      <pre data-testid="clauses-state">{JSON.stringify(clauses)}</pre>
    </div>
  )
}

const stateOf = () => JSON.parse(screen.getByTestId('clauses-state').textContent ?? '[]')

describe('AdvancedRulesEditor — empty state', () => {
  it('shows a placeholder when there are no clauses', () => {
    render(<Harness initial={[]} />)
    expect(screen.getByText(/No advanced rules yet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Add rule' })).toBeInTheDocument()
  })
})

describe('AdvancedRulesEditor — add / remove', () => {
  it('Add rule appends a default eq clause and opens it for editing', () => {
    render(<Harness initial={[]} />)
    fireEvent.click(screen.getByRole('button', { name: '+ Add rule' }))
    expect(stateOf()).toEqual([{ op: 'eq', path: '', value: '' }])
    // Newly added row is in edit mode → ClauseEditor is visible.
    expect(screen.getByLabelText('Operation')).toBeInTheDocument()
  })

  it('Remove drops the chosen clause by index', () => {
    render(<Harness initial={[
      { op: 'eq', path: 'a', value: 1 },
      { op: 'eq', path: 'b', value: 2 },
    ]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove rule 1' }))
    expect(stateOf()).toEqual([{ op: 'eq', path: 'b', value: 2 }])
  })
})

describe('AdvancedRulesEditor — summaries + edit toggle', () => {
  it('renders one summary phrase per clause', () => {
    render(<Harness initial={[
      { op: 'gte', path: 'meta.capabilities.capacity_lbs', value: 80000 },
      { op: 'within', path: 'meta.location', from: { kind: 'proposed' }, miles: 50 },
    ]} />)
    expect(screen.getByTestId('advanced-rule-summary-0')).toHaveTextContent('capacity lbs ≥ 80,000')
    expect(screen.getByTestId('advanced-rule-summary-1')).toHaveTextContent('within 50 mi of event')
  })

  it('Edit reveals the ClauseEditor; Done collapses it again', () => {
    render(<Harness initial={[
      { op: 'gte', path: 'meta.capabilities.capacity_lbs', value: 80000 },
    ]} />)
    expect(screen.queryByLabelText('Operation')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Operation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByLabelText('Operation')).toBeNull()
  })

  it('inline edits mutate the right clause without touching siblings', () => {
    render(<Harness initial={[
      { op: 'eq', path: 'a', value: 'x' },
      { op: 'eq', path: 'b', value: 'y' },
    ]} />)
    // Open the second row's editor.
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[1]!)
    fireEvent.change(screen.getByLabelText('Field path'), { target: { value: 'renamed' } })
    expect(stateOf()).toEqual([
      { op: 'eq', path: 'a', value: 'x' },
      { op: 'eq', path: 'renamed', value: 'y' },
    ])
  })
})
