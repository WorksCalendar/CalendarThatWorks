"""Generate DFD diagram images for Works Calendar."""
import graphviz
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'docs', 'diagrams')
os.makedirs(OUT, exist_ok=True)

GRAPH_ATTRS = {
    'fontname': 'Helvetica',
    'fontsize': '11',
    'bgcolor': 'white',
    'pad': '0.4',
    'splines': 'ortho',
    'ranksep': '0.7',
    'nodesep': '0.5',
}
NODE_ATTRS = {
    'fontname': 'Helvetica',
    'fontsize': '10',
    'shape': 'box',
    'style': 'rounded,filled',
    'fillcolor': '#f5f5f5',
    'color': '#555555',
    'margin': '0.2,0.1',
}
EDGE_ATTRS = {
    'fontname': 'Helvetica',
    'fontsize': '9',
    'color': '#444444',
    'arrowsize': '0.7',
}

def new_graph(name, direction='TB'):
    g = graphviz.Digraph(name, graph_attr={**GRAPH_ATTRS, 'rankdir': direction},
                         node_attr=NODE_ATTRS, edge_attr=EDGE_ATTRS)
    return g

def ext_node(g, name, label):
    g.node(name, label, shape='rectangle', style='filled',
           fillcolor='#dce8f5', color='#2266aa')

def process_node(g, name, label):
    g.node(name, label, shape='box', style='rounded,filled',
           fillcolor='#e8f5e8', color='#226622')

def store_node(g, name, label):
    g.node(name, label, shape='cylinder', style='filled',
           fillcolor='#fff8e0', color='#886600')

def subsystem_node(g, name, label):
    g.node(name, label, shape='box', style='rounded,filled',
           fillcolor='#f0f0ff', color='#444488', fontsize='10')


# ── Level 0 ──────────────────────────────────────────────────────────────────

def level0():
    g = new_graph('level0', 'TB')
    g.attr(label='Level 0 — Context Diagram', labelloc='t', fontsize='14', fontname='Helvetica Bold')

    ext_node(g, 'host',    'Host App\n(React tree)')
    process_node(g, 'lib', 'WORKS CALENDAR\nLIBRARY')
    ext_node(g, 'remote',  'Remote Data Source\n(REST / WS / Supabase / ICS)')
    store_node(g, 'storage','Browser Storage\n(localStorage)\n• config\n• pools\n• profile / theme')
    ext_node(g, 'channels','External Channels\n(Slack / email / webhooks)')

    g.edge('host',    'lib',      'raw events, config,\nadapter, renderers')
    g.edge('lib',     'host',     'rendered views,\ncallbacks')
    g.edge('lib',     'remote',   'CRUD operations')
    g.edge('remote',  'lib',      'loadRange / subscribe')
    g.edge('lib',     'storage',  'read / write')
    g.edge('lib',     'channels', 'booking lifecycle\nnotifications')

    g.render(os.path.join(OUT, 'level0'), format='png', cleanup=True)
    print('level0.png done')


# ── Level 1 ──────────────────────────────────────────────────────────────────

def level1():
    g = new_graph('level1', 'TB')
    g.attr(label='Level 1 — Subsystem Diagram', labelloc='t', fontsize='14', fontname='Helvetica Bold')

    ext_node(g, 'host',      'Host App')
    ext_node(g, 'remote',    'Remote Data Source')
    ext_node(g, 'storage',   'Browser Storage')
    ext_node(g, 'channels',  'External Channels')

    subsystem_node(g, 's1',  '1. Adapter Layer\nRestAdapter / WsAdapter\nSupabaseAdapter / ICSAdapter\nSyncManager')
    subsystem_node(g, 's2',  '2. Calendar Engine\nCalendarState\n(events, assignments, deps,\n pools, view, cursor)')
    subsystem_node(g, 's3',  '3. Occurrence Expansion\nexpandOccurrences\n(rrule → dated occurrences)')
    subsystem_node(g, 's4',  '4. Filter & Grouping\nfilterEngine  conditionEngine\ngroupRows  sortEngine')
    subsystem_node(g, 's5',  '5. View Layer\nMonth / Week / Day\nSchedule / Agenda\nMap / Assets / Dispatch')
    subsystem_node(g, 's6',  '6. Workflow & Approvals\nWorkflow DSL  transitions\nauditChain  holdRegistry')
    subsystem_node(g, 's7',  '7. Config & Persistence\nparseConfig  profileStore\npoolStore  savedViews\nthemeSystem')
    subsystem_node(g, 'ui',  'UI / Forms\nEventForm  FilterBar\nWorkflowBuilder\nConfigPanel  Export')

    g.edge('host',    's1',  'rawEvents[], config, adapter')
    g.edge('s1',      's2',  'CalendarEventV1[]')
    g.edge('s2',      's1',  'CRUD operations', style='dashed')
    g.edge('s1',      'channels', 'AdapterChange\n→ EventBus', style='dashed')
    g.edge('s2',      's3',  'CalendarState\n(EngineEvents[])')
    g.edge('s3',      's4',  'EngineOccurrence[]')
    g.edge('host',    's4',  'filterSchema\nfilterState')
    g.edge('s4',      's5',  'visibleEvents[]')
    g.edge('s5',      's6',  'approval transitions')
    g.edge('s6',      's5',  'emit events', style='dashed')
    g.edge('s5',      'ui',  'user actions')
    g.edge('ui',      's7',  'settings writes')
    g.edge('s7',      'ui',  'config / theme')
    g.edge('host',    's7',  'config.json')
    g.edge('s7',      'storage', 'read / write')

    g.render(os.path.join(OUT, 'level1'), format='png', cleanup=True)
    print('level1.png done')


# ── Level 2 helpers ───────────────────────────────────────────────────────────

def level2a():
    g = new_graph('l2a', 'TB')
    g.attr(label='2a — Calendar Engine + Orchestration Hook', labelloc='t', fontsize='13', fontname='Helvetica Bold')

    ext_node(g, 'op', 'EngineOperation\n(type, eventId,\nnewStart/End, resource, meta)')
    process_node(g, 'pool',     'resolvePoolOnSubmit()\nPick resource via pool strategy\nRewrite op with concrete resourceId')
    process_node(g, 'validate', 'validateOperation()\n1. validateDuration          (hard)\n2. validateBlockedWindow     (hard)\n3. validateEventConstraints  (configurable)\n4. validateDependencies      (hard)\n5. validateOverlap           (hard)\n6. validateWorkingHours      (soft)')
    process_node(g, 'scope',    'resolveOperationScope()\nthis-only / this+future / all-in-series')
    process_node(g, 'build',    'buildOperation() + applyOperation()\n→ EventChange[] {created|updated|deleted}')
    process_node(g, 'commit',   'beginTransaction() / commitTransaction()\nAtomic Map swap + pool cursor advance')
    process_node(g, 'emit',     '_emitBookingLifecycle()\nEventBus.emit(booking.requested\n| approved | denied | cancelled)')
    process_node(g, 'notify',   '_notify() → StateListeners')

    ext_node(g, 'rejected',   'OperationResult\n{rejected}')
    ext_node(g, 'pending',    'OperationResult\n{pending-confirmation}')
    ext_node(g, 'result',     'OperationResult\n{status, violations, changes}')
    ext_node(g, 'state_out',  'CalendarState\n(new events Map)')
    ext_node(g, 'bus_out',    'EventBus payload\n→ Slack / email / webhooks')

    process_node(g, 'undo',   'UndoRedoManager\npush(label?) — snapshot before mutation\nundo() → restoreState()\nredo() → restoreState()')

    g.edge('op',       'pool')
    g.edge('pool',     'validate')
    g.edge('validate', 'rejected',  'hard violation')
    g.edge('validate', 'pending',   'soft violation\n(no override)')
    g.edge('validate', 'scope',     'clean')
    g.edge('scope',    'build')
    g.edge('build',    'commit')
    g.edge('commit',   'emit')
    g.edge('emit',     'notify')
    g.edge('notify',   'result')
    g.edge('notify',   'state_out')
    g.edge('emit',     'bus_out')
    g.edge('undo',     'pool',      'wraps engine', style='dashed')

    g.render(os.path.join(OUT, 'level2a'), format='png', cleanup=True)
    print('level2a.png done')


def level2b():
    g = new_graph('l2b', 'TB')
    g.attr(label='2b — Occurrence Expansion & Filtering', labelloc='t', fontsize='13', fontname='Helvetica Bold')

    ext_node(g, 'events_in', 'CalendarState.events\n(Map<id, EngineEvent>)')
    ext_node(g, 'range_in',  'rangeStart / rangeEnd\n(from cursor + view type)')
    process_node(g, 'get_occ', 'getOccurrencesInRange()')
    process_node(g, 'eng_filter', 'Engine Filter (pre-expansion)\nsearch → title match only\ncategories → Set.has()\nresources  → Set.has()')
    process_node(g, 'expand',  'expandOccurrences()\nrangePadDays ?? 7\nmaxPerSeries ?? 500\nexpandRRule(start, rrule, exdates,\n            expStart, expEnd)')
    process_node(g, 'assign',  'Assignment Join\nresourceIdsForEvent()')
    process_node(g, 'sort',    'Sort by start asc')
    ext_node(g, 'occ_out',   'EngineOccurrence[]\noccurrenceId · eventId · seriesId\nstart · end · resourceIds[]\nisRecurring · occurrenceIndex\nconstraints[] · meta')

    process_node(g, 'apply_f', 'applyFilters(items, filterState, schema)\ntext → title + resource + category + meta\ndate-range / multi-select / select\nboolean / custom predicate')
    process_node(g, 'cond',    'conditionsToFilters(conditions, schema)\nCONVERTS condition rows → filterState\n(does not evaluate)')
    process_node(g, 'sort2',   'sortEvents(events, sortConfigs[])\nMulti-key stable sort; nulls last')
    process_node(g, 'group',   'groupRows(rows, { groupBy, fieldAccessor })\n→ { flatRows: Row[], groupOrder: string[] }\nFlat interleaved list with groupHeader rows')
    ext_node(g, 'view_out',  '{ flatRows[], groupOrder[] }\n→ active View component')

    g.edge('events_in', 'get_occ')
    g.edge('range_in',  'get_occ')
    g.edge('get_occ',   'eng_filter', '1.')
    g.edge('eng_filter','expand',     '2.')
    g.edge('expand',    'assign',     '3.')
    g.edge('assign',    'sort',       '4.')
    g.edge('sort',      'occ_out')
    g.edge('occ_out',   'apply_f',    'normalized\nNormalizedEvent[]')
    g.edge('cond',      'apply_f',    'filterState', style='dashed')
    g.edge('apply_f',   'sort2')
    g.edge('sort2',     'group')
    g.edge('group',     'view_out')

    g.render(os.path.join(OUT, 'level2b'), format='png', cleanup=True)
    print('level2b.png done')


def level2c():
    g = new_graph('l2c', 'TB')
    g.attr(label='2c — Adapter Layer & Sync', labelloc='t', fontsize='13', fontname='Helvetica Bold')

    with g.subgraph(name='cluster_adapters') as sg:
        sg.attr(label='CalendarAdapter (interface)', style='rounded', color='#888888')
        for n, lbl in [('ra','RestAdapter\nloadRange()\ncreateEvent\nupdateEvent\ndeleteEvent'),
                       ('wa','WsAdapter\nsubscribe()\n(WebSocket)'),
                       ('sa','SupabaseAdapter\n(realtime channel)'),
                       ('ia','ICSAdapter\nimportFeed\nparseICS()')]:
            subsystem_node(sg, n, lbl)

    process_node(g, 'sm',  'SYNC MANAGER\nloadRange(start, end)\ncreateEvent / updateEvent / deleteEvent\n\n1. Apply optimistically to local Map\n2. Enqueue (status: pending)\n3. Notify subscribers\n4. Call adapter in background')
    process_node(g, 'success', '✓ success\nmark synced\nreplace with server copy')
    process_node(g, 'conflict','✗ conflict\nconflictResolver(local, server)\nserver-wins | client-wins\nlatest-wins | manual')
    process_node(g, 'error',   '✗ error\nmark error, call onError\nretry up to maxRetries\n(exponential backoff)')
    process_node(g, 'live',    'connectLive()\nadapter.subscribe()\ninsert/update/delete → patch Map\nreload → merge full set')

    ext_node(g, 'state_out', 'SyncState\n{ events, status,\n  errors, isSyncing,\n  pendingCount }')
    ext_node(g, 'hook',      'useSyncedCalendar hook\n(React wrapper)')

    g.edge('ra', 'sm', 'CalendarEventV1[]')
    g.edge('wa', 'sm')
    g.edge('sa', 'sm')
    g.edge('ia', 'sm')
    g.edge('sm', 'success',  'adapter call')
    g.edge('sm', 'conflict', 'adapter call')
    g.edge('sm', 'error',    'adapter call')
    g.edge('live', 'sm',     'AdapterChange', style='dashed')
    g.edge('sm',  'state_out')
    g.edge('state_out', 'hook')

    g.render(os.path.join(OUT, 'level2c'), format='png', cleanup=True)
    print('level2c.png done')


def level2d():
    g = new_graph('l2d', 'TB')
    g.attr(label='2d — Workflow & Approval System', labelloc='t', fontsize='13', fontname='Helvetica Bold')

    ext_node(g, 'action',   'User Action\nsubmit / approve / deny\ndowngrade / finalize / revoke')
    ext_node(g, 'wf_dsl',   'Workflow DSL\n(Workflow JSON)')
    ext_node(g, 'stage_in', 'ApprovalStage\n(from event.meta)')

    process_node(g, 'ta',   'transitionApproval()')
    process_node(g, 'v1',   '1. Validate\nVALID_STAGES check\nDENY_REQUIRES_REASON\nfindTransition(from, action)\n→ ILLEGAL_TRANSITION if no match')
    process_node(g, 'v2',   '2. resolveApproveTarget()\nSingle-tier shortcut\nrevoke resets counts to 0')
    process_node(g, 'v3',   '3. appendAuditEntry(history, seed)\nSHA-256 hash chain\n→ new ApprovalStage')
    process_node(g, 'v4',   '4. advance({ workflow, instance,\n             action, at, variables })\nauto-walk condition + notify nodes\nstop at approval (awaiting)\nor terminal (completed/denied)\nparallel quorum: requireAll/Any/N\n→ AdvanceResult { ok, instance, emit }')
    process_node(g, 'v5',   '5. Return TransitionResult\n{ ok, stage, workflowInstance?, emit? }')

    ext_node(g, 'stage_out','Updated ApprovalStage')
    ext_node(g, 'wf_out',   'WorkflowInstance\n(host persists)')
    ext_node(g, 'emit_out', 'WorkflowEmitEvent[]\nnode_entered · node_exited\nnotify · workflow_completed\nworkflow_failed')
    ext_node(g, 'channels', 'EventBus channels\nbooking.approved\nbooking.denied\nbooking.cancelled\n→ Slack / email / webhooks')

    process_node(g, 'ticker','useWorkflowTicker\nsetInterval (default 30s)\nfires on mount\ndeduped per (nodeId, enteredAt)\n→ onTimeout(result, emit)')
    process_node(g, 'holds', 'HoldRegistry — createHoldRegistry()\nregistry.acquire({ resourceId, window,\n  holderId, ttlMs? }) default TTL: 5 min\nregistry.release(holdId)\nregistry.active(now?)\nregistry.prune(now?)\nfindBlockingHold() → conflictEngine')

    g.edge('action',   'ta')
    g.edge('wf_dsl',   'ta')
    g.edge('stage_in', 'ta')
    g.edge('ta',       'v1')
    g.edge('v1',       'v2')
    g.edge('v2',       'v3')
    g.edge('v3',       'v4')
    g.edge('v4',       'v5')
    g.edge('v5',       'stage_out')
    g.edge('v5',       'wf_out')
    g.edge('v5',       'emit_out')
    g.edge('emit_out', 'channels')

    g.render(os.path.join(OUT, 'level2d'), format='png', cleanup=True)
    print('level2d.png done')


def level2e():
    g = new_graph('l2e', 'TB')
    g.attr(label='2e — View Layer', labelloc='t', fontsize='13', fontname='Helvetica Bold')

    ext_node(g, 'in_events', 'visibleEvents[]\n(grouped/sorted)')
    ext_node(g, 'in_cursor', 'cursor\n(currentDate)')
    ext_node(g, 'in_view',   "view type\n'month'|'week'|'day'|'schedule'\n'agenda'|'map'|'assets'|'dispatch'")

    process_node(g, 'dispatch', 'VIEW DISPATCH\nswitch(view) → mount View component')

    with g.subgraph(name='cluster_views') as sv:
        sv.attr(label='View Components', style='rounded', color='#888888')
        for n, lbl in [('mv','MonthView\n7-col week grid'),
                       ('wv','WeekView\ntime column 00–24'),
                       ('dv','DayView\nsingle resource col'),
                       ('sv2','ScheduleView\nhorizontal time bars'),
                       ('av','AgendaView\ndate-grouped list'),
                       ('ov','Map/Assets/Dispatch')]:
            subsystem_node(sv, n, lbl)

    process_node(g, 'layout', 'SHARED LAYOUT PIPELINE\nlayoutOverlaps(events)\n  → { _col, _numCols } per event\nlayoutSpans(events, weekStart, weekEnd)\n  → LayoutSpanItem[] { lane, startCol, endCol }\n  → displayEndDay() all-day DTEND handling\ngroupRows(rows, { groupBy, fieldAccessor })\n  → { flatRows, groupOrder }')

    process_node(g, 'pill',   'EVENT PILL RENDER\ndata-wc-event-id="{id}"\naria-label with time range\nrenderEvent(event)? : default title+badge\nresolveColor(event, colorRules)')

    process_node(g, 'drag',   'DRAG & DROP — useDrag({ pxPerHour, dayStart, dayEnd })\n.startMove / .startResize / .startResizeTop / .startCreate\n.onPointerMove → ghost position (15-min snap)\n.onPointerUp → DragResult { type, ev, newStart, newEnd }\napplyEngineOp(op, onAccepted)\n  → applyWithRecurringCheck (this / future / all)\n  → engine.applyMutation → validate → commit')

    ext_node(g, 'click_out', 'onClick\n→ onEventClick\nor open EventForm')
    ext_node(g, 'hover_out', 'HoverCard portal\nrenderHoverCard()?\nedit · delete · move\n→ engine ops')

    g.edge('in_events', 'dispatch')
    g.edge('in_cursor', 'dispatch')
    g.edge('in_view',   'dispatch')
    g.edge('dispatch',  'mv')
    g.edge('dispatch',  'wv')
    g.edge('dispatch',  'dv')
    g.edge('dispatch',  'sv2')
    g.edge('dispatch',  'av')
    g.edge('dispatch',  'ov')
    g.edge('mv',        'layout')
    g.edge('wv',        'layout')
    g.edge('layout',    'pill',      'positioned pills')
    g.edge('pill',      'click_out', 'click')
    g.edge('pill',      'hover_out', 'hover/focus')
    g.edge('pill',      'drag',      'pointer down')

    g.render(os.path.join(OUT, 'level2e'), format='png', cleanup=True)
    print('level2e.png done')


def level2f():
    g = new_graph('l2f', 'TB')
    g.attr(label='2f — Config & Persistence', labelloc='t', fontsize='13', fontname='Helvetica Bold')

    store_node(g, 'storage', 'localStorage')
    process_node(g, 'load',    'loadConfig(calendarId)\nRead raw JSON\nMerge DEFAULT_CONFIG')
    process_node(g, 'parse',   'parseConfig(raw)\n→ { config: CalendarConfig,\n    errors: string[],\n    dropped: number }\nNever throws; drops bad entries')
    process_node(g, 'validate','validateConfig(config)\n→ { ok, issues: ConfigIssue[] }\nCross-checks: resource.type,\npool.memberIds, requirement\nroles/pools, seed events,\nduplicate ids')
    process_node(g, 'labels',  "resolveLabels(config)\n→ { resource, resources,\n    event, events,\n    location, locations, …extras }\nOrder: override → preset → fallback")
    process_node(g, 'preset',  "applyProfilePreset(profileId, base?)\nPreset fills gaps; base wins\nProfileId: 'trucking' | 'aviation'\n'air_medical' | 'equipment_rental'\n'scheduling' | 'custom'")

    with g.subgraph(name='cluster_stores') as ss:
        ss.attr(label='Downstream Stores', style='rounded', color='#888888')
        process_node(ss, 'pools',   'Pool Store\nloadPools() / savePools()\nclearPools() / validatePools()\nkey: wc_pools')
        process_node(ss, 'views',   'Saved Views\nserializeFilters()\ndeserializeFilters()\ncal.setView on apply')
        process_node(ss, 'theme',   'Theme System\nnormalizeTheme(id)\nresolveCssTheme(id)\nTHEMES_BY_ID (13 themes)')

    process_node(g, 'save',    'saveConfig(calendarId, config)\n→ localStorage\nConfigPanel → onUpdate → host persists')

    g.edge('storage', 'load')
    g.edge('load',    'parse')
    g.edge('parse',   'validate')
    g.edge('validate','labels')
    g.edge('labels',  'preset')
    g.edge('preset',  'pools',  'CalendarConfig')
    g.edge('preset',  'views',  'CalendarConfig')
    g.edge('preset',  'theme',  'CalendarConfig')
    g.edge('pools',   'storage', 'wc_pools', style='dashed')
    g.edge('save',    'storage', style='dashed')

    g.render(os.path.join(OUT, 'level2f'), format='png', cleanup=True)
    print('level2f.png done')


def level2g():
    g = new_graph('l2g', 'TB')
    g.attr(label='2g — Conflict Engine', labelloc='t', fontsize='13', fontname='Helvetica Bold')

    ext_node(g, 'input', 'EvaluateConflictsInput\n{ proposed: ConflictEvent\n  events: ConflictEvent[]\n  rules: ConflictRule[]\n  resources?, assignments?\n  categories?, now?\n  holds?, holderId? }')

    with g.subgraph(name='cluster_rules') as sr:
        sr.attr(label='Rule Evaluators (each returns Violation | null)', style='rounded', color='#888888')
        for n, lbl in [
            ('r1','ResourceOverlapRule\nsame resource, overlapping time'),
            ('r2','CategoryMutexRule\nmutual-exclusion pair'),
            ('r3','MinRestRule\nminimum gap between shifts'),
            ('r4','CapacityOverflowRule\nresource over max capacity'),
            ('r5','OutsideBusinessHoursRule\nevent outside configured hours'),
            ('r6','PolicyViolationRule\nmin-lead-time · max-dur\nmax-advance · blackout-dates'),
            ('r7','HoldConflictRule\noverlaps a live booking hold'),
            ('r8','AvailabilityViolationRule\nevent during marked unavailability'),
        ]:
            subsystem_node(sr, n, lbl)

    process_node(g, 'eval', 'evaluateConflicts()\nRun each enabled rule against proposed')
    ext_node(g, 'out', 'ConflictEvaluationResult\n{ violations: Violation[]\n  severity: none|soft|hard\n  allowed: boolean }')
    ext_node(g, 'note', '⚠ NOT part of validateOperation()\nHost/gate calls independently')

    g.edge('input', 'eval')
    g.edge('eval',  'r1')
    g.edge('eval',  'r2')
    g.edge('eval',  'r3')
    g.edge('eval',  'r4')
    g.edge('eval',  'r5')
    g.edge('eval',  'r6')
    g.edge('eval',  'r7')
    g.edge('eval',  'r8')
    g.edge('r1',    'out', style='invis')
    g.edge('eval',  'out')
    g.edge('out',   'note', style='dashed', arrowhead='none')

    g.render(os.path.join(OUT, 'level2g'), format='png', cleanup=True)
    print('level2g.png done')


def level2h():
    g = new_graph('l2h', 'TB')
    g.attr(label='2h — Requirements Engine', labelloc='t', fontsize='13', fontname='Helvetica Bold')

    ext_node(g, 'input', 'EvaluateRequirementsInput\n{ requirements: ConfigRequirement[]\n  event: NormalizedEvent\n  assignedResources: string[]\n  availableResources: ConfigResource[] }')
    process_node(g, 'eval', 'evaluateRequirements()\nFor each ConfigRequirement:\n  count assigned resources matching role\n  compare vs minCount / maxCount\n  produce RequirementShortfall if outside bounds')
    ext_node(g, 'eval_out', 'RequirementsEvaluation\n{ missing: RequirementShortfall[]\n  { kind: role|pool\n    severity: hard|soft\n    required · assigned · missing } }')
    process_node(g, 'gate', 'gateEventRequirements()\nWraps evaluateRequirements → ValidationResult\nhard shortfall → reject operation\nsoft shortfall → warn, allow override\nmissing.length === 0 → allowed: true')
    ext_node(g, 'gate_out', 'ValidationResult\n{ allowed, violations[] }')
    ext_node(g, 'note', '⚠ NOT called from validateOperation()\nSeparate utility; host invokes independently')

    g.edge('input',    'eval')
    g.edge('eval',     'eval_out')
    g.edge('eval_out', 'gate')
    g.edge('gate',     'gate_out')
    g.edge('gate_out', 'note', style='dashed', arrowhead='none')

    g.render(os.path.join(OUT, 'level2h'), format='png', cleanup=True)
    print('level2h.png done')


def level2i():
    g = new_graph('l2i', 'TB')
    g.attr(label='2i — Geo Conflict Engine', labelloc='t', fontsize='13', fontname='Helvetica Bold')

    ext_node(g, 'loc_step', 'Location Resolution (caller)\nattachLocations(events, adapter)\ncreateStaticLocationAdapter()\ncreateMetaPathLocationAdapter()\ncreateManualLocationProvider()')
    ext_node(g, 'input', 'proposed: GeoEventInput\nothers:   GeoEventInput[]\n{ id · start · end\n  resourceId · location: LatLon }')
    process_node(g, 'eval', 'evaluateGeoConflicts(rules, proposed, others)')
    process_node(g, 'rule', 'GeoTravelFeasibilityRule\ngap  = proposed.start − other.end (min)\ndist = haversineDistanceKm(loc1, loc2)\nspeed = rule.speedKmh  (default 800)\ntravel = dist / speed × 60\nif travel > gap → violation')
    ext_node(g, 'out', 'GeoConflictViolation[]\n{ ruleId · resourceId\n  conflictingEventId\n  distanceKm · gapMinutes\n  travelMinutes · message }')
    ext_node(g, 'note', '⚠ Not wired into validateConstraints()\nHost calls after each engine commit')

    g.edge('loc_step', 'input')
    g.edge('input',    'eval')
    g.edge('eval',     'rule')
    g.edge('rule',     'out')
    g.edge('out',      'note', style='dashed', arrowhead='none')

    g.render(os.path.join(OUT, 'level2i'), format='png', cleanup=True)
    print('level2i.png done')


def level2j():
    g = new_graph('l2j', 'TB')
    g.attr(label='2j — Pool Query DSL', labelloc='t', fontsize='13', fontname='Helvetica Bold')

    ext_node(g, 'pool', 'ResourcePool\n{ id · name · type\n  strategy · memberIds[]\n  query?: ResourceQuery }')
    process_node(g, 'eval', 'evaluateQuery(pool.query, resources, context)')
    with g.subgraph(name='cluster_clauses') as sc:
        sc.attr(label='ResourceQuery Clause Tree', style='rounded', color='#888888')
        subsystem_node(sc, 'comb', 'Combinators\nand(clauses[]) / or(clauses[]) / not(clause)')
        subsystem_node(sc, 'leaf', 'Leaf Clauses\nexists(path)\neq / neq / in(path, value)\ngt / gte / lt / lte(path, n)\nwithin(path, { km|miles, from: point|proposed })')
    ext_node(g, 'eval_out', 'QueryEvaluation\n{ matched: string[]\n  excluded: QueryExclusion[]\n  { id · reason } }')
    process_node(g, 'pick', 'resolvePoolOnSubmit() — pick winner\nmatched ∩ memberIds\n→ round-robin (atomic cursor)\n→ random (Math.random())\n→ least-busy (count assignments)\nRewrite op.resourceId = winner')

    g.edge('pool', 'eval')
    g.edge('eval', 'comb')
    g.edge('eval', 'leaf')
    g.edge('comb', 'eval_out', style='invis')
    g.edge('eval', 'eval_out')
    g.edge('eval_out', 'pick')

    g.render(os.path.join(OUT, 'level2j'), format='png', cleanup=True)
    print('level2j.png done')


# ── Level 3 ───────────────────────────────────────────────────────────────────

def level3a():
    g = new_graph('l3a', 'TB')
    g.attr(label='3a — Engine Validation Pipeline', labelloc='t', fontsize='13', fontname='Helvetica Bold')

    ext_node(g, 'op', 'EngineOperation\n(after pool resolution)')
    process_node(g, 'entry',  'validateOperation(op, events, ctx)')
    process_node(g, 's1',    '1. validateDuration(op)\nstart < end? min duration met?\n→ hard if fails')
    process_node(g, 's2',    '2. validateBlockedWindow(op, ctx)\nop within a blocked window?\n→ hard if blocked')
    process_node(g, 's3',    '3. validateEventConstraints(op, ctx)\nEvent-level custom constraints\n→ hard or soft per config')
    process_node(g, 's4',    '4. validateDependencies(op, deps)\nSuccessors: newEnd ≤ succ.start?\nPredecessors: pred.end ≤ newStart?\nO(k) index lookup\n→ hard if violated')
    process_node(g, 's5',    '5. validateOverlap(op, events)\nSame resource: interval overlap?\n(excludes op.eventId itself)\n→ hard if overlap found')
    process_node(g, 's6',    '6. validateWorkingHours(op, ctx)\nOutside businessHours days/start/end?\n(allDay events skipped)\n→ soft violation')

    ext_node(g, 'rejected',  'OperationResult\n{ status: rejected }')
    ext_node(g, 'pending',   'OperationResult\n{ status: pending-confirmation }')
    process_node(g, 'pass',  'resolveOperationScope()\nbuildOperation() → applyOperation()\nbeginTransaction() → commitTransaction()')
    ext_node(g, 'note',      '⚠ evaluateConflicts() and\ngateEventRequirements()\nare NOT called here')

    g.edge('op',    'entry')
    g.edge('entry', 's1')
    g.edge('s1',    's2')
    g.edge('s2',    's3')
    g.edge('s3',    's4')
    g.edge('s4',    's5')
    g.edge('s5',    's6')
    g.edge('s1',    'rejected', 'hard', style='dashed')
    g.edge('s2',    'rejected', 'hard', style='dashed')
    g.edge('s3',    'rejected', 'hard', style='dashed')
    g.edge('s4',    'rejected', 'hard', style='dashed')
    g.edge('s5',    'rejected', 'hard', style='dashed')
    g.edge('s3',    'pending',  'soft', style='dashed')
    g.edge('s6',    'pending',  'soft', style='dashed')
    g.edge('s6',    'pass',     'clean')
    g.edge('pass',  'note',     style='dashed', arrowhead='none')

    g.render(os.path.join(OUT, 'level3a'), format='png', cleanup=True)
    print('level3a.png done')


def level3b():
    g = new_graph('l3b', 'TB')
    g.attr(label='3b — React Hook Subscription Chain', labelloc='t', fontsize='13', fontname='Helvetica Bold')

    process_node(g, 'engine',   'CalendarEngine singleton\n(useRef — stable across renders)')
    process_node(g, 'registry', 'StateListener registry\nSet<(state: CalendarState) => void>')
    process_node(g, 'tick',     'useCalendarEngine listener\ntickEngine() — useReducer +1\nschedules React re-render')
    process_node(g, 'rerun',    'useCalendarEngine re-runs\ngetOccurrencesInRange()\n→ expandedEvents[]\nstate.assignments\n→ approvalRequestEvents')
    process_node(g, 'ctx',      'CalendarContext.Provider\n(useMemo on engineVer)\n{ renderEvent · renderHoverCard\n  colorRules · businessHours\n  permissions · editMode\n  conflictingEventIds }')
    process_node(g, 'view',     'View components\nuseContext(CalendarContext)\ntyped dot-notation\n(no bracket hacks)')
    ext_node(g, 'batch',        'React 18 auto-batching\nMultiple _notify() calls\n→ one re-render per commit')

    g.edge('engine',   'registry', 'engine.subscribe()\n[on mount]')
    g.edge('registry', 'tick',     'engine._notify()\n[after commitTransaction()]')
    g.edge('tick',     'rerun',    'React re-render')
    g.edge('rerun',    'ctx',      'passed down')
    g.edge('ctx',      'view',     'useContext()')
    g.edge('engine',   'batch',    style='dashed', arrowhead='none')

    g.render(os.path.join(OUT, 'level3b'), format='png', cleanup=True)
    print('level3b.png done')


def level3c():
    g = new_graph('l3c', 'TB')
    g.attr(label='3c — MonthView Layout Algorithm', labelloc='t', fontsize='13', fontname='Helvetica Bold')

    ext_node(g, 'events', 'visibleEvents[]\n(month window)')
    process_node(g, 's1', '1. Build week grid\neachWeekOfInterval()\n7 DayCell components per week')
    process_node(g, 's2', '2. Partition per week\nallDayOrSpanning: allDay===true\n  OR span ≥ 1 calendar day\ntimedSingle: same-day start/end')
    process_node(g, 's3', '3. All-day / multi-day layout\nlayoutSpans(candidates, weekStart, weekEnd)\nGreedy lane assignment\nmaxVisibleRows = 3\noverflow → "+N more" chip\n→ AgendaView on chip click')
    process_node(g, 's4', '4. Timed event layout\nlayoutOverlaps(timedForDay)\nAssign _col, _numCols\npill left = (_col/_numCols) × 100%\npill width = (1/_numCols) × 100%')
    process_node(g, 's5', '5. Render pass\nDayCell: all-day band + timed body\nheight = (durationMin/60) × hourPx\nmin 20px (touch target)\ntoday = accent bg')

    g.edge('events', 's1')
    g.edge('s1',     's2')
    g.edge('s2',     's3', 'allDayOrSpanning')
    g.edge('s2',     's4', 'timedSingle')
    g.edge('s3',     's5')
    g.edge('s4',     's5')

    g.render(os.path.join(OUT, 'level3c'), format='png', cleanup=True)
    print('level3c.png done')


def level3d():
    g = new_graph('l3d', 'TB')
    g.attr(label='3d — WeekView / DayView Time Grid', labelloc='t', fontsize='13', fontname='Helvetica Bold')

    ext_node(g, 'events', 'visibleEvents[]\n(week or single day)')
    process_node(g, 's1', '1. Time column\nArray(24) hourSlots\n64px/hr default\nSticky time labels\nScrollable grid + resource cols')
    process_node(g, 's2', '2. Pixel positioning\ntopPx = (startHour×60 + startMin) × pxPerMin\nheightPx = durationMin × pxPerMin\nfloor: 20px')
    process_node(g, 's3', '3. Overlap resolution\nlayoutOverlaps(eventsInColumn)\nSweep-line → overlap clusters\n_col, _numCols per event\npill width = colWidth/_numCols − 2px')
    process_node(g, 's4', '4. All-day banner\nallDayEvents → layoutSpans()\nIdentical lane logic to MonthView')
    process_node(g, 's5', '5. Business hours shading\nbusinessHours.days/.start/.end\nOverlay div — visual only\nEnforcement in validateWorkingHours')
    process_node(g, 's6', '6. Current-time indicator\nredLine topPx = minutesSinceMidnight(now) × pxPerMin\nUpdates every 60s via useInterval\nOnly when today in view window')

    g.edge('events', 's1')
    g.edge('s1',     's2')
    g.edge('s2',     's3')
    g.edge('s3',     's4')
    g.edge('s4',     's5')
    g.edge('s5',     's6')

    g.render(os.path.join(OUT, 'level3d'), format='png', cleanup=True)
    print('level3d.png done')


def level3e():
    g = new_graph('l3e', 'TB')
    g.attr(label='3e — Config / Engine Initialization Sequence', labelloc='t', fontsize='13', fontname='Helvetica Bold')

    process_node(g, 'mount',   'WorksCalendar mount')
    process_node(g, 'sync',    'Synchronous init (render phase)\nuseState: view, currentDate,\n  filters, dayWindow\nuseMemo: allNormalized = normalizeEvents()\nuseCalendarEngine():\n  engine = new CalendarEngine()\n  undoRedo = new UndoRedoManager(engine)')
    process_node(g, 'eff1',    'Effect 1 — pool sync\n[dep: rawPools]\nloadPools()\nengine.setPools(pools)\ntickEngine()')
    process_node(g, 'eff2',    'Effect 2 — event sync\n[dep: allNormalized]\nengine.setEvents(allNormalized)\ntickEngine()')
    process_node(g, 'eff3',    'Effect 3 — view sync\n[dep: view]\nengine.dispatch(SET_VIEW)')
    process_node(g, 'eff4',    'Effect 4 — cursor sync\n[dep: currentDate]\nengine.dispatch(NAVIGATE_TO)')
    ext_node(g, 'ready',       'Engine ready / UI rendered')
    ext_node(g, 'note',        '⚠ Config gap\nbusinessHours, requirements,\nconflict rules passed as props\nat operation time — not loaded\ninto engine state at init')

    g.edge('mount', 'sync')
    g.edge('sync',  'eff1',  '[after mount]')
    g.edge('eff1',  'eff2')
    g.edge('eff2',  'eff3')
    g.edge('eff3',  'eff4')
    g.edge('eff4',  'ready')
    g.edge('ready', 'note', style='dashed', arrowhead='none')

    g.render(os.path.join(OUT, 'level3e'), format='png', cleanup=True)
    print('level3e.png done')


def level3f():
    g = new_graph('l3f', 'LR')
    g.attr(label='3f — Undo / Redo Snapshot Mechanism', labelloc='t', fontsize='13', fontname='Helvetica Bold')

    process_node(g, 'before',  'Before each mutation\napplyEngineOp() called')
    process_node(g, 'push',    'UndoRedoManager.push(label?)\ncaptureSnapshot():\n  events · assignments\n  dependencies · resourceCalendars · pools\npush → undoStack[]\nclear redoStack[]\nmax depth 50 (FIFO eviction)')
    process_node(g, 'mutate',  'Operation dispatched\ncommitted → UI updated')
    process_node(g, 'undo',    'Ctrl+Z — undo()\npop undoStack\npush current → redoStack\nengine.restoreState(snapshot)\nengine._notify() → re-render')
    process_node(g, 'redo',    'Ctrl+Y — redo()\npop redoStack\npush current → undoStack\nengine.restoreState(snapshot)\nengine._notify() → re-render')
    ext_node(g, 'scope',       'Snapshot scope\n✓ Events · Assignments\n✓ Dependencies\n✓ Resource calendars\n✓ Pool cursors\n✗ View / cursor (not undoable)\n✗ Filter state\n✗ Config / savedViews\n✗ In-flight adapter ops')

    g.edge('before',  'push')
    g.edge('push',    'mutate')
    g.edge('mutate',  'undo', 'Ctrl+Z')
    g.edge('mutate',  'redo', 'Ctrl+Y')
    g.edge('undo',    'scope', style='dashed', arrowhead='none')
    g.edge('redo',    'scope', style='dashed', arrowhead='none')

    g.render(os.path.join(OUT, 'level3f'), format='png', cleanup=True)
    print('level3f.png done')


def level3g():
    g = new_graph('l3g', 'TB')
    g.attr(label='3g — SyncQueue: Optimistic Update, Retry & Conflict Resolution', labelloc='t', fontsize='13', fontname='Helvetica Bold')

    ext_node(g, 'call',      'createEvent / updateEvent\n/ deleteEvent on SyncManager')
    process_node(g, 'opt',   '1. Optimistic apply (sync)\nUpdate local Map immediately\nSyncStatus → pending')
    process_node(g, 'enq',   '2. SyncQueue.enqueue()\n{ op, adapterFn, retryCount: 0 }')
    process_node(g, 'flush', '3. Background flush (async)\nadapterFn() call')
    process_node(g, 'ok',    '✓ Success\nSyncStatus → synced\nReplace with server copy\n(server id replaces temp id on create)')
    process_node(g, 'retry', '✗ Transient error\nretryCount < maxRetries?\nbackoff: 2^n × 1000ms\nre-enqueue retryCount++\nelse → SyncStatus: error\nonSyncError callback')
    process_node(g, 'conf',  '✗ Conflict\nconflictResolver(local, server)\nserver-wins → revert, apply server\nclient-wins → force-push local\nlatest-wins → compare updatedAt\nmanual → onConflict modal')
    process_node(g, 'live',  'connectLive() parallel path\nadapter.subscribe()\ninsert → merge (skip if pending)\nupdate → apply if synced\ndelete → remove\nreload → replace full Map')

    g.edge('call',  'opt')
    g.edge('opt',   'enq')
    g.edge('enq',   'flush')
    g.edge('flush', 'ok',    'success')
    g.edge('flush', 'retry', 'error')
    g.edge('flush', 'conf',  'conflict')
    g.edge('live',  'flush', 'push change', style='dashed')

    g.render(os.path.join(OUT, 'level3g'), format='png', cleanup=True)
    print('level3g.png done')


if __name__ == '__main__':
    level0()
    level1()
    level2a(); level2b(); level2c(); level2d(); level2e()
    level2f(); level2g(); level2h(); level2i(); level2j()
    level3a(); level3b(); level3c(); level3d()
    level3e(); level3f(); level3g()
    print(f'\nAll diagrams written to docs/diagrams/')
