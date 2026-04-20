// @vitest-environment happy-dom
import { useState } from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom'

import { WorkflowNodeInspector } from '../WorkflowNodeInspector'
import type {
  WorkflowApprovalNode,
  WorkflowConditionNode,
  WorkflowNode,
  WorkflowNotifyNode,
  WorkflowTerminalNode,
} from '../../core/workflow/workflowSchema'

/**
 * Stateful harness. The inspector is a controlled component; its
 * value props only reflect new state if the parent re-renders with
 * the updated node. Routing patches through React state also ensures
 * React emits `change` events consistently even when the coerced DOM
 * value would otherwise be identical across fires.
 */
function Harness<T extends WorkflowNode>({
  initial,
  spy,
}: { initial: T; spy: (patch: Partial<T>) => void }): JSX.Element {
  const [node, setNode] = useState<T>(initial)
  return (
    <WorkflowNodeInspector
      node={node}
      onChange={patch => {
        spy(patch as Partial<T>)
        setNode(prev => ({ ...prev, ...patch }) as T)
      }}
    />
  )
}

describe('WorkflowNodeInspector — common fields', () => {
  it('renders the node id as read-only', () => {
    const node: WorkflowApprovalNode = {
      id: 'approve',
      type: 'approval',
      assignTo: 'role:x',
    }
    render(<WorkflowNodeInspector node={node} onChange={vi.fn()} />)
    const idField = screen.getByLabelText(/node id/i) as HTMLInputElement
    expect(idField.value).toBe('approve')
    expect(idField).toBeDisabled()
  })

  it('emits a patch when the label changes', () => {
    const onChange = vi.fn()
    const node: WorkflowApprovalNode = {
      id: 'approve',
      type: 'approval',
      assignTo: 'role:x',
    }
    render(<WorkflowNodeInspector node={node} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/^label$/i), {
      target: { value: 'My approval' },
    })
    expect(onChange).toHaveBeenLastCalledWith({ label: 'My approval' })
  })
})

describe('WorkflowNodeInspector — approval', () => {
  const baseNode: WorkflowApprovalNode = {
    id: 'approve',
    type: 'approval',
    assignTo: 'role:director',
  }

  it('edits assignTo', () => {
    const onChange = vi.fn()
    render(<WorkflowNodeInspector node={baseNode} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/assign to/i), {
      target: { value: 'user:alice' },
    })
    expect(onChange).toHaveBeenLastCalledWith({ assignTo: 'user:alice' })
  })

  it('parses slaMinutes as a number, clears on empty', () => {
    const spy = vi.fn()
    render(<Harness initial={baseNode} spy={spy} />)
    const field = screen.getByLabelText(/sla minutes/i)
    fireEvent.change(field, { target: { value: '30' } })
    expect(spy).toHaveBeenLastCalledWith({ slaMinutes: 30 })
    fireEvent.change(field, { target: { value: '' } })
    expect(spy).toHaveBeenLastCalledWith({ slaMinutes: undefined })
  })

  it('ignores negative or non-numeric slaMinutes', () => {
    const spy = vi.fn()
    render(<Harness initial={baseNode} spy={spy} />)
    const field = screen.getByLabelText(/sla minutes/i)
    fireEvent.change(field, { target: { value: '-5' } })
    expect(spy).not.toHaveBeenCalledWith(expect.objectContaining({ slaMinutes: -5 }))
  })

  it('edits onTimeout to a known behavior', () => {
    const onChange = vi.fn()
    render(<WorkflowNodeInspector node={baseNode} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/on timeout/i), {
      target: { value: 'auto-approve' },
    })
    expect(onChange).toHaveBeenLastCalledWith({ onTimeout: 'auto-approve' })
  })

  it('clears onTimeout when set to the blank option', () => {
    const onChange = vi.fn()
    const node: WorkflowApprovalNode = { ...baseNode, onTimeout: 'escalate' }
    render(<WorkflowNodeInspector node={node} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/on timeout/i), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith({ onTimeout: undefined })
  })
})

describe('WorkflowNodeInspector — condition', () => {
  const makeNode = (expr: string): WorkflowConditionNode => ({
    id: 'c',
    type: 'condition',
    expr,
  })

  it('emits every keystroke to onChange', () => {
    const onChange = vi.fn()
    render(<WorkflowNodeInspector node={makeNode('event.cost > 500')} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/expression/i), {
      target: { value: 'event.cost > 1000' },
    })
    expect(onChange).toHaveBeenLastCalledWith({ expr: 'event.cost > 1000' })
  })

  it('shows no syntax error for a valid expression', () => {
    vi.useFakeTimers()
    try {
      render(<WorkflowNodeInspector node={makeNode('event.cost > 500')} onChange={vi.fn()} />)
      const hint = screen.getByText(/evaluated against action variables/i)
      expect(hint).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('surfaces a syntax error after the debounce for invalid input', () => {
    vi.useFakeTimers()
    try {
      render(<WorkflowNodeInspector node={makeNode('event.cost > 500')} onChange={vi.fn()} />)
      fireEvent.change(screen.getByLabelText(/expression/i), {
        target: { value: 'event.cost >' },
      })
      // Before the debounce fires, no error is visible.
      expect(screen.queryByText(/syntax|unexpected|empty/i)).toBeNull()
      act(() => { vi.advanceTimersByTime(200) })
      const textarea = screen.getByLabelText(/expression/i) as HTMLTextAreaElement
      expect(textarea.getAttribute('aria-invalid')).toBe('true')
    } finally {
      vi.useRealTimers()
    }
  })

  it('flags empty expressions as errors', () => {
    vi.useFakeTimers()
    try {
      render(<WorkflowNodeInspector node={makeNode('event.cost > 500')} onChange={vi.fn()} />)
      fireEvent.change(screen.getByLabelText(/expression/i), {
        target: { value: '' },
      })
      act(() => { vi.advanceTimersByTime(200) })
      expect(screen.getByText(/empty/i)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('WorkflowNodeInspector — notify', () => {
  const node: WorkflowNotifyNode = {
    id: 'n',
    type: 'notify',
    channel: 'slack',
  }

  it('edits channel', () => {
    const onChange = vi.fn()
    render(<WorkflowNodeInspector node={node} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/channel/i), { target: { value: 'email' } })
    expect(onChange).toHaveBeenLastCalledWith({ channel: 'email' })
  })

  it('clears template to undefined when emptied', () => {
    const onChange = vi.fn()
    const withTemplate: WorkflowNotifyNode = { ...node, template: 'foo' }
    render(<WorkflowNodeInspector node={withTemplate} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/template/i), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith({ template: undefined })
  })
})

describe('WorkflowNodeInspector — terminal', () => {
  it('edits outcome to a known value', () => {
    const onChange = vi.fn()
    const node: WorkflowTerminalNode = {
      id: 't',
      type: 'terminal',
      outcome: 'finalized',
    }
    render(<WorkflowNodeInspector node={node} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/outcome/i), { target: { value: 'cancelled' } })
    expect(onChange).toHaveBeenLastCalledWith({ outcome: 'cancelled' })
  })
})
