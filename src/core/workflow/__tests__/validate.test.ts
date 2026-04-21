import { describe, it, expect } from 'vitest'
import {
  validateWorkflow,
  hasBlockingErrors,
  validateExpressionSyntax,
  validateTemplateSyntax,
} from '../validate'
import {
  WORKFLOW_TEMPLATES,
  singleApproverWorkflow,
  conditionalByCostWorkflow,
} from '../templates'
import type { Workflow } from '../workflowSchema'

describe('validateWorkflow — shipped templates', () => {
  it('every shipped template validates clean (no errors)', () => {
    for (const wf of WORKFLOW_TEMPLATES) {
      const issues = validateWorkflow(wf)
      const errors = issues.filter(i => i.severity === 'error')
      expect(errors).toEqual([])
    }
  })
})

describe('validateWorkflow — rules', () => {
  it('flags duplicate node ids', () => {
    const wf: Workflow = {
      ...singleApproverWorkflow,
      nodes: [
        ...singleApproverWorkflow.nodes,
        { id: 'approve', type: 'terminal', outcome: 'finalized' },
      ],
    }
    const issues = validateWorkflow(wf)
    expect(issues.some(i => i.code === 'duplicate-node-id')).toBe(true)
  })

  it('flags missing startNodeId', () => {
    const wf: Workflow = { ...singleApproverWorkflow, startNodeId: 'ghost' }
    const issues = validateWorkflow(wf)
    expect(issues.some(i => i.code === 'start-node-missing')).toBe(true)
  })

  it('flags edges pointing at non-existent nodes', () => {
    const wf: Workflow = {
      ...singleApproverWorkflow,
      edges: [
        ...singleApproverWorkflow.edges,
        { from: 'approve', to: 'ghost', when: 'approved' },
      ],
    }
    const issues = validateWorkflow(wf)
    expect(issues.some(i => i.code === 'edge-endpoint-missing')).toBe(true)
  })

  it('flags workflows with no terminal nodes', () => {
    const wf: Workflow = {
      id: 'w', version: 1, trigger: 'on_submit', startNodeId: 'a',
      nodes: [
        { id: 'a', type: 'approval', assignTo: 'role:x' },
      ],
      edges: [
        { from: 'a', to: 'a', when: 'approved' },
        { from: 'a', to: 'a', when: 'denied' },
      ],
    }
    const issues = validateWorkflow(wf)
    expect(issues.some(i => i.code === 'no-terminal-node')).toBe(true)
  })

  it('flags unreachable nodes as warnings', () => {
    const wf: Workflow = {
      ...singleApproverWorkflow,
      nodes: [
        ...singleApproverWorkflow.nodes,
        { id: 'orphan', type: 'terminal', outcome: 'cancelled' },
      ],
    }
    const issues = validateWorkflow(wf)
    const orphan = issues.find(i => i.code === 'unreachable-node' && i.nodeId === 'orphan')
    expect(orphan?.severity).toBe('warning')
  })

  it('flags non-terminal nodes with no outgoing edges', () => {
    const wf: Workflow = {
      id: 'w', version: 1, trigger: 'on_submit', startNodeId: 'a',
      nodes: [
        { id: 'a', type: 'approval', assignTo: 'role:x' },
        { id: 'done', type: 'terminal', outcome: 'finalized' },
      ],
      edges: [{ from: 'a', to: 'done', when: 'approved' }],
    }
    // Approval 'a' is missing its denied edge — but crucially it still
    // has an outgoing edge. Add a node 'b' with no outgoing at all:
    const wf2: Workflow = {
      ...wf,
      nodes: [
        ...wf.nodes,
        { id: 'b', type: 'notify', channel: 'slack' },
      ],
      edges: [
        ...wf.edges,
        { from: 'a', to: 'b', when: 'denied' },
      ],
    }
    const issues = validateWorkflow(wf2)
    expect(issues.some(i => i.code === 'dead-end-node' && i.nodeId === 'b')).toBe(true)
  })

  it('flags multiple default edges from the same source', () => {
    const wf: Workflow = {
      ...conditionalByCostWorkflow,
      edges: [
        ...conditionalByCostWorkflow.edges,
        { from: 'notify-ops', to: 'done' },
      ],
    }
    const issues = validateWorkflow(wf)
    expect(issues.some(i => i.code === 'multiple-default-edges')).toBe(true)
  })

  it('flags approvals missing approved or denied outgoing edges', () => {
    const wf: Workflow = {
      ...singleApproverWorkflow,
      edges: singleApproverWorkflow.edges.filter(e => e.when !== 'denied'),
    }
    const issues = validateWorkflow(wf)
    expect(
      issues.some(i => i.code === 'approval-missing-signal-coverage' && i.message.includes('denied')),
    ).toBe(true)
  })

  it('accepts approval with approved+default edges (signal coverage via default)', () => {
    const wf: Workflow = {
      id: 'w', version: 1, trigger: 'on_submit', startNodeId: 'a',
      nodes: [
        { id: 'a', type: 'approval', assignTo: 'role:x' },
        { id: 'done', type: 'terminal', outcome: 'finalized' },
        { id: 'denied', type: 'terminal', outcome: 'denied' },
      ],
      // No explicit 'denied' edge — default covers it.
      edges: [
        { from: 'a', to: 'done',   when: 'approved' },
        { from: 'a', to: 'denied', when: 'default'  },
      ],
    }
    const issues = validateWorkflow(wf).filter(i => i.severity === 'error')
    expect(issues).toEqual([])
  })

  it('accepts condition with true+default edges (signal coverage via default)', () => {
    const wf: Workflow = {
      id: 'w', version: 1, trigger: 'on_submit', startNodeId: 'c',
      nodes: [
        { id: 'c', type: 'condition', expr: 'event.cost > 500' },
        { id: 'hi', type: 'terminal', outcome: 'finalized' },
        { id: 'lo', type: 'terminal', outcome: 'finalized' },
      ],
      edges: [
        { from: 'c', to: 'hi', when: 'true' },
        { from: 'c', to: 'lo' /* default */ },
      ],
    }
    const issues = validateWorkflow(wf).filter(i => i.severity === 'error')
    expect(issues).toEqual([])
  })

  it('flags conditions missing true or false outgoing edges', () => {
    const wf: Workflow = {
      ...conditionalByCostWorkflow,
      edges: conditionalByCostWorkflow.edges.filter(e => e.when !== 'true'),
    }
    const issues = validateWorkflow(wf)
    expect(issues.some(i => i.code === 'condition-missing-signal-coverage')).toBe(true)
  })

  it('flags guards that are illegal for their source node type', () => {
    const wf: Workflow = {
      ...singleApproverWorkflow,
      edges: [
        ...singleApproverWorkflow.edges,
        { from: 'approve', to: 'done', when: 'true' },
      ],
    }
    const issues = validateWorkflow(wf)
    expect(issues.some(i => i.code === 'illegal-guard-for-source')).toBe(true)
  })

  it('flags condition nodes with bad expression syntax', () => {
    const wf: Workflow = {
      ...conditionalByCostWorkflow,
      nodes: conditionalByCostWorkflow.nodes.map(n =>
        n.id === 'check-cost'
          ? { ...n, expr: 'event.cost >' }
          : n,
      ),
    }
    const issues = validateWorkflow(wf)
    expect(issues.some(i => i.code === 'expression-syntax')).toBe(true)
  })

  it('flags approvals with onTimeout=escalate but no timeout edge', () => {
    const wf: Workflow = {
      id: 'w', version: 1, trigger: 'on_submit', startNodeId: 'a',
      nodes: [
        { id: 'a', type: 'approval', assignTo: 'role:x', slaMinutes: 30, onTimeout: 'escalate' },
        { id: 'done', type: 'terminal', outcome: 'finalized' },
        { id: 'denied', type: 'terminal', outcome: 'denied' },
      ],
      edges: [
        { from: 'a', to: 'done', when: 'approved' },
        { from: 'a', to: 'denied', when: 'denied' },
      ],
    }
    const issues = validateWorkflow(wf)
    expect(issues.some(i => i.code === 'timeout-edge-missing' && i.severity === 'error')).toBe(true)
  })

  it('accepts auto-approve approvals without a timeout edge', () => {
    const wf: Workflow = {
      id: 'w', version: 1, trigger: 'on_submit', startNodeId: 'a',
      nodes: [
        { id: 'a', type: 'approval', assignTo: 'role:x', slaMinutes: 30, onTimeout: 'auto-approve' },
        { id: 'done', type: 'terminal', outcome: 'finalized' },
        { id: 'denied', type: 'terminal', outcome: 'denied' },
      ],
      edges: [
        { from: 'a', to: 'done', when: 'approved' },
        { from: 'a', to: 'denied', when: 'denied' },
      ],
    }
    const errors = validateWorkflow(wf).filter(i => i.severity === 'error')
    expect(errors).toEqual([])
  })

  it('warns when slaMinutes is set but onTimeout is not', () => {
    const wf: Workflow = {
      id: 'w', version: 1, trigger: 'on_submit', startNodeId: 'a',
      nodes: [
        { id: 'a', type: 'approval', assignTo: 'role:x', slaMinutes: 30 },
        { id: 'done', type: 'terminal', outcome: 'finalized' },
        { id: 'denied', type: 'terminal', outcome: 'denied' },
        { id: 'esc', type: 'approval', assignTo: 'role:d' },
      ],
      edges: [
        { from: 'a', to: 'done', when: 'approved' },
        { from: 'a', to: 'denied', when: 'denied' },
        { from: 'a', to: 'esc', when: 'timeout' },
        { from: 'esc', to: 'done', when: 'approved' },
        { from: 'esc', to: 'denied', when: 'denied' },
      ],
    }
    const issues = validateWorkflow(wf)
    const warn = issues.find(i => i.code === 'sla-without-on-timeout')
    expect(warn?.severity).toBe('warning')
  })

  it('flags timeout guard on approval without slaMinutes as illegal', () => {
    const wf: Workflow = {
      id: 'w', version: 1, trigger: 'on_submit', startNodeId: 'a',
      nodes: [
        { id: 'a', type: 'approval', assignTo: 'role:x' },
        { id: 'done', type: 'terminal', outcome: 'finalized' },
        { id: 'denied', type: 'terminal', outcome: 'denied' },
      ],
      edges: [
        { from: 'a', to: 'done', when: 'approved' },
        { from: 'a', to: 'denied', when: 'denied' },
        { from: 'a', to: 'denied', when: 'timeout' },
      ],
    }
    const issues = validateWorkflow(wf)
    expect(issues.some(i => i.code === 'illegal-guard-for-source')).toBe(true)
  })

  it('flags terminals that carry outgoing edges (warning)', () => {
    const wf: Workflow = {
      ...singleApproverWorkflow,
      edges: [
        ...singleApproverWorkflow.edges,
        { from: 'done', to: 'denied' },
      ],
    }
    const issues = validateWorkflow(wf)
    const warn = issues.find(i => i.code === 'terminal-has-outgoing')
    expect(warn?.severity).toBe('warning')
  })
})

describe('hasBlockingErrors', () => {
  it('is false when only warnings exist', () => {
    const issues = [
      { code: 'unreachable-node' as const, severity: 'warning' as const, message: 'x' },
    ]
    expect(hasBlockingErrors(issues)).toBe(false)
  })
  it('is true when any error exists', () => {
    const issues = [
      { code: 'unreachable-node' as const, severity: 'warning' as const, message: 'x' },
      { code: 'no-terminal-node' as const, severity: 'error' as const, message: 'y' },
    ]
    expect(hasBlockingErrors(issues)).toBe(true)
  })
})

describe('validateWorkflow — notify channel + template rules (issue #223)', () => {
  function withNotify(template: string | undefined, channel = 'slack'): Workflow {
    return {
      id: 'nf', version: 1, trigger: 'on_submit', startNodeId: 'n',
      nodes: [
        { id: 'n', type: 'notify', channel, ...(template !== undefined ? { template } : {}) },
        { id: 'done', type: 'terminal', outcome: 'finalized' },
      ],
      edges: [{ from: 'n', to: 'done' }],
    }
  }

  it('flags empty channel as error', () => {
    const wf = withNotify(undefined, '')
    const issues = validateWorkflow(wf)
    expect(issues.some(i => i.code === 'empty-channel' && i.severity === 'error')).toBe(true)
  })

  it('warns when notify uses an unregistered channel (given knownChannels)', () => {
    const wf = withNotify('hi', 'teams')
    const issues = validateWorkflow(wf, { knownChannels: ['slack', 'email'] })
    const issue = issues.find(i => i.code === 'unknown-channel')
    expect(issue?.severity).toBe('warning')
    expect(issue?.nodeId).toBe('n')
  })

  it('skips unknown-channel check when knownChannels is omitted', () => {
    const wf = withNotify('hi', 'anything-goes')
    const issues = validateWorkflow(wf)
    expect(issues.some(i => i.code === 'unknown-channel')).toBe(false)
  })

  it('skips unknown-channel check when knownChannels is an empty array', () => {
    // Regression: callers passing a not-yet-populated registry should
    // not see every notify node flagged as unknown.
    const wf = withNotify('hi', 'anything-goes')
    const issues = validateWorkflow(wf, { knownChannels: [] })
    expect(issues.some(i => i.code === 'unknown-channel')).toBe(false)
  })

  it('accepts a notify with a registered channel cleanly', () => {
    const wf = withNotify('hi', 'slack')
    const issues = validateWorkflow(wf, { knownChannels: ['slack'] })
    expect(issues.some(i => i.code === 'unknown-channel')).toBe(false)
    expect(issues.some(i => i.code === 'empty-channel')).toBe(false)
  })

  it('flags unterminated {{ }} tokens in templates', () => {
    const wf = withNotify('hi {{ actor.name')
    const issues = validateWorkflow(wf)
    const issue = issues.find(i => i.code === 'template-syntax')
    expect(issue?.severity).toBe('error')
    expect(issue?.nodeId).toBe('n')
  })

  it('flags expression syntax errors inside template tokens', () => {
    const wf = withNotify('{{ 1 + }}')
    const issues = validateWorkflow(wf)
    expect(issues.some(i => i.code === 'template-syntax' && i.severity === 'error')).toBe(true)
  })

  it('does not flag templates that reference unbound variables', () => {
    // edit-time: vars aren't supplied; undefined-variable is expected.
    const wf = withNotify('Hi {{ actor.name }}')
    const issues = validateWorkflow(wf)
    expect(issues.some(i => i.code === 'template-syntax')).toBe(false)
  })

  it('does not flag templates with no tokens', () => {
    const wf = withNotify('plain text')
    const issues = validateWorkflow(wf)
    expect(issues.some(i => i.code === 'template-syntax')).toBe(false)
  })
})

describe('validateTemplateSyntax', () => {
  it('returns null for clean templates (even with unbound vars)', () => {
    expect(validateTemplateSyntax('')).toBeNull()
    expect(validateTemplateSyntax('Hi {{ actor.name }}')).toBeNull()
    expect(validateTemplateSyntax('no tokens')).toBeNull()
  })

  it('reports unterminated tokens', () => {
    expect(validateTemplateSyntax('hi {{ name')).not.toBeNull()
  })

  it('reports empty tokens', () => {
    expect(validateTemplateSyntax('{{ }}')).not.toBeNull()
  })

  it('reports expression syntax errors inside tokens', () => {
    expect(validateTemplateSyntax('{{ 1 + }}')).not.toBeNull()
  })
})

describe('validateWorkflow — parallel / join (issue #223)', () => {
  function parallelWf(overrides: {
    parallelBranches?: readonly string[]
    mode?: 'requireAll' | 'requireAny' | 'requireN'
    n?: number
    pairedJoinId?: string
    edgeOverrides?: readonly { readonly from: string; readonly to: string; readonly when?: string }[]
    removeJoin?: boolean
    extraJoins?: readonly { id: string; pairedWith: string }[]
  } = {}): Workflow {
    const pairedJoinId = overrides.pairedJoinId ?? 'join'
    const base: Workflow = {
      id: 'par', version: 1, trigger: 'on_submit', startNodeId: 'fan',
      nodes: [
        {
          id: 'fan', type: 'parallel',
          branches: overrides.parallelBranches ?? ['a', 'b'],
          mode: overrides.mode ?? 'requireAll',
          ...(overrides.n !== undefined ? { n: overrides.n } : {}),
        },
        { id: 'a', type: 'approval', assignTo: 'role:a' },
        { id: 'b', type: 'approval', assignTo: 'role:b' },
        ...(overrides.removeJoin ? [] : [{ id: pairedJoinId, type: 'join' as const, pairedWith: 'fan' }]),
        ...(overrides.extraJoins ?? []).map(j => ({ ...j, type: 'join' as const })),
        { id: 'done', type: 'terminal', outcome: 'finalized' },
      ],
      edges: (overrides.edgeOverrides as readonly { from: string; to: string; when?: string }[] | undefined) ?? [
        { from: 'a', to: pairedJoinId, when: 'branch-completed' },
        { from: 'b', to: pairedJoinId, when: 'branch-completed' },
        { from: pairedJoinId, to: 'done' },
      ],
    } as Workflow
    return base
  }

  it('accepts a simple parallel + join template', () => {
    const issues = validateWorkflow(parallelWf())
    const errors = issues.filter(i => i.severity === 'error')
    expect(errors).toEqual([])
  })

  it('flags parallel with no paired join', () => {
    const issues = validateWorkflow(parallelWf({
      removeJoin: true,
      edgeOverrides: [
        { from: 'a', to: 'done' },
        { from: 'b', to: 'done' },
      ],
    }))
    expect(issues.some(i => i.code === 'parallel-join-unpaired')).toBe(true)
  })

  it('flags parallel paired with two joins', () => {
    const issues = validateWorkflow(parallelWf({
      extraJoins: [{ id: 'join2', pairedWith: 'fan' }],
    }))
    expect(issues.some(
      i => i.code === 'parallel-join-unpaired' && /2 joins/i.test(i.message),
    )).toBe(true)
  })

  it('flags a join pointing at a non-existent parallel', () => {
    const wf: Workflow = {
      ...parallelWf(),
      nodes: [
        ...parallelWf().nodes,
        { id: 'orphan-join', type: 'join', pairedWith: 'ghost' },
      ],
    }
    const issues = validateWorkflow(wf)
    expect(issues.some(
      i => i.code === 'parallel-join-unpaired' && i.nodeId === 'orphan-join',
    )).toBe(true)
  })

  it('flags branches that do not rejoin at the paired join', () => {
    const wf: Workflow = parallelWf({
      // Branch "a" exits to a terminal instead of rejoining.
      edgeOverrides: [
        { from: 'a', to: 'done', when: 'approved' },
        { from: 'a', to: 'done', when: 'denied' },
        { from: 'b', to: 'join', when: 'branch-completed' },
        { from: 'join', to: 'done' },
      ],
    })
    const issues = validateWorkflow(wf)
    expect(issues.some(
      i => i.code === 'parallel-branches-rejoin' && /branch "a"/.test(i.message),
    )).toBe(true)
  })

  it('flags requireN without a valid n', () => {
    const tooLow = validateWorkflow(parallelWf({ mode: 'requireN', n: 0 }))
    expect(tooLow.some(i => i.code === 'parallel-require-n-bounds')).toBe(true)
    const tooHigh = validateWorkflow(parallelWf({ mode: 'requireN', n: 5 }))
    expect(tooHigh.some(i => i.code === 'parallel-require-n-bounds')).toBe(true)
    const missing = validateWorkflow(parallelWf({ mode: 'requireN' }))
    expect(missing.some(i => i.code === 'parallel-require-n-bounds')).toBe(true)
  })

  it('accepts requireN with n within branch count', () => {
    const issues = validateWorkflow(parallelWf({ mode: 'requireN', n: 2 }))
    const errors = issues.filter(i => i.severity === 'error')
    expect(errors).toEqual([])
  })

  it('flags a parallel with zero declared branches', () => {
    const issues = validateWorkflow(parallelWf({ parallelBranches: [] }))
    expect(issues.some(i => i.code === 'parallel-branches-empty')).toBe(true)
  })

  it('flags a parallel branch entry that is not a node', () => {
    const issues = validateWorkflow(parallelWf({ parallelBranches: ['a', 'ghost'] }))
    expect(issues.some(
      i => i.code === 'parallel-branches-rejoin' && /ghost/.test(i.message),
    )).toBe(true)
  })

  it('does not flag a parallel node as a dead-end (no outgoing edges)', () => {
    const issues = validateWorkflow(parallelWf())
    expect(issues.some(i => i.code === 'dead-end-node' && i.nodeId === 'fan')).toBe(false)
  })
})

describe('validateExpressionSyntax', () => {
  it('returns null for clean expressions (even with unbound vars)', () => {
    expect(validateExpressionSyntax('event.cost > 500')).toBeNull()
    expect(validateExpressionSyntax('1 + 2 == 3')).toBeNull()
  })
  it('reports empty expressions', () => {
    expect(validateExpressionSyntax('')).toMatch(/empty/i)
    expect(validateExpressionSyntax('   ')).toMatch(/empty/i)
  })
  it('reports syntax errors', () => {
    expect(validateExpressionSyntax('event.cost >')).not.toBeNull()
    expect(validateExpressionSyntax('(1 + 2')).not.toBeNull()
  })
})
