# Sprint Review: Infinite Grouping, Filtering & Sorting

**Date:** 2026-04-16
**Status:** ⚠️ NOT RECOMMENDED AS PROPOSED
**Full Analysis:** [INFINITE_GROUPING_VIABILITY_ANALYSIS.md](./INFINITE_GROUPING_VIABILITY_ANALYSIS.md)

---

## TL;DR - Key Takeaways

### 🔴 Critical Issues

1. **Unrealistic Timeline** - 5 days proposed vs 15-20 days needed (3-4 weeks)
2. **High Breaking Change Risk** - All 5 views must be modified, high regression probability
3. **Performance Unknowns** - No benchmarks, 5-level nesting on 1000 events untested
4. **Incomplete Architecture** - No grouping infrastructure exists, building from scratch

### ✅ What's Working Well

1. **Excellent Filtering Foundation** - Schema-driven system is production-ready and extensible
2. **Solid Saved Views** - Persistence, migration, and state management already work
3. **Strong Engine Pattern** - CalendarEngine for recurring events is robust

### 💡 Recommended Path Forward

**Option A: Phased Approach (7-9 weeks total)**
- Week 1-2: Enhanced filtering + FilterBuilder UI
- Week 3-4: Single-level grouping (TimelineView only)
- Week 5-9: Multi-level grouping + all views

**Option B: Minimal Grouping (2 weeks)**
- Single-level grouping only
- TimelineView and AgendaView support
- Defer multi-level nesting to future release

**Option C: Enhanced Filtering Only (2 weeks)**
- Skip grouping entirely for now
- Focus on FilterBuilder UI and logical operators (AND/OR/NOT)
- Deliver immediate user value with lower risk

---

## Risk Assessment

| Aspect | Risk Level | Notes |
|--------|-----------|-------|
| **Timeline** | 🔴 Very High | 5 days → 20 days realistic |
| **Breaking Changes** | 🟡 High | All views affected, saved views schema changes |
| **Performance** | 🟡 High | Nested rendering, virtualization needed |
| **Testing Effort** | 🟡 High | 36 existing tests, need 50+ new tests |
| **User Confusion** | 🟢 Low | Good defaults can mitigate |
| **Technical Debt** | 🟡 Medium | +1500 LOC, new maintenance burden |

---

## Why the Original Plan Won't Work

### 1. Grouping Infrastructure Doesn't Exist

**Current State:**
- TimelineView has hardcoded employee rows
- Other views have no grouping concept
- No `GroupConfig`, `useGroupingEngine`, or group rendering components

**Reality:**
- Building this from scratch takes weeks, not days
- Each view has unique rendering logic that must be adapted

### 2. View Integration is Complex

**Current Views:**
- `MonthView` - Grid layout with day cells
- `WeekView` - Weekly columns
- `DayView` - Single day
- `AgendaView` - Flat list
- `TimelineView` - Virtualized employee rows

**Challenge:**
- Grouping makes sense for Timeline and Agenda, but NOT for Month/Week/Day grids
- Forcing grouping onto all views will break their rendering paradigms
- Each view needs different grouping UX

### 3. Performance Optimization is Non-Trivial

**Proposed:** "Add React.memo + virtualized group rendering"

**Reality:**
- Nested group rendering is complex (recursive components, collapse state)
- Current virtualization is flat (TimelineView rows)
- Cross-group visibility ("showAllGroups") doubles rendered events
- No performance baselines established

### 4. Testing Scope is Underestimated

**Proposed:**
- Unit tests: `useNormalizedConfig` + `useGroupingEngine`
- E2E tests: 5 scenarios
- Target: 95% coverage

**Reality Needed:**
- 50+ unit tests for grouping edge cases
- 20+ integration tests (grouping × filtering × sorting combinations)
- 15+ E2E tests across all views
- Performance benchmarks
- Accessibility tests
- Visual regression tests

---

## What Should Happen Next

### Immediate Actions (Before Any Code is Written)

1. **Stakeholder Alignment Meeting**
   - Review this analysis
   - Decide between Option A (phased), B (minimal), or C (filtering only)
   - Get buy-in on realistic timeline

2. **Technical Spikes (1 week)**
   - Prototype nested group rendering
   - Benchmark performance with current codebase
   - Test drag-and-drop between groups
   - Validate approach before full implementation

3. **Reduce Scope for v1**
   - ✅ Keep: Single-level grouping, schema-driven config
   - ✅ Keep: TimelineView and AgendaView support
   - ❌ Remove: 5+ level nesting (start with 2 max)
   - ❌ Remove: FilterBuilder UI (defer to Phase 2)
   - ❌ Remove: All-view grouping support

### Success Criteria for Reduced Scope

**v1 - Single-Level Grouping (2 weeks):**
```jsx
<WorksCalendar
  events={events}
  employees={employees}
  groupBy="location"  // or "shift" or "specialty"
  view="schedule"
/>
```

**Delivers:**
- Users can group schedule by ONE field
- Works in TimelineView
- Integrates with saved views
- No breaking changes

**Defers:**
- Multi-level nesting (location → shift → specialty)
- FilterBuilder UI
- Cross-group visibility
- Grouping in Month/Week/Day views

---

## Architectural Recommendations

### 1. Event Processing Pipeline

**Recommended Flow:**
```
rawEvents
  → normalize (eventModel.js)
  → expand recurring (CalendarEngine)
  → filter (filterEngine.js) ← Already works well
  → sort (new: sortEngine.js)
  → group (new: groupingEngine.js)
  → render (views)
```

**Key Principle:** Each stage is independent and testable.

### 2. Backward Compatibility Strategy

**Required:**
- All new props optional with sensible defaults
- Saved views migration path (v2 → v3)
- Feature flags for gradual rollout
- Regression test suite before merge

**Storage Schema:**
```typescript
// src/hooks/useSavedViews.js:26-39
function normalizeSavedView(view) {
  return {
    id: view.id,
    name: view.name,
    filters: view.filters,
    // NEW FIELDS (must add to whitelist)
    groupBy: view.groupBy ?? null,
    sort: view.sort ?? null,
    showAllGroups: view.showAllGroups ?? false,
    // ...
  };
}
```

### 3. Performance Budget

**Targets:**
- 60fps rendering with 500 events
- <100ms grouping operation
- <50ms filter + sort operation
- Virtualization for 10+ groups

**Monitoring:**
- React DevTools Profiler during development
- Lighthouse performance scores
- Real-world usage metrics

---

## Questions for Product Team

Before proceeding, please answer:

1. **Which use case is most critical?**
   - [ ] Location → Shift → Specialty (3-level nesting)
   - [ ] Just Location OR Shift OR Specialty (single-level)
   - [ ] Cross-team visibility ("showAllGroups")
   - [ ] Advanced filtering with AND/OR logic

2. **Which views MUST support grouping?**
   - [ ] TimelineView (schedule) - Makes sense
   - [ ] AgendaView (list) - Makes sense
   - [ ] MonthView (grid) - Doesn't make sense
   - [ ] WeekView (columns) - Doesn't make sense
   - [ ] DayView (single day) - Doesn't make sense

3. **What's the acceptable timeline?**
   - [ ] 2 weeks (minimal scope - single-level grouping)
   - [ ] 4 weeks (moderate scope - 2-level grouping + sorting)
   - [ ] 8 weeks (full scope - unlimited nesting, all features)

4. **What's more important?**
   - [ ] Grouping features (location → shift nesting)
   - [ ] Filtering features (AND/OR logic, advanced filters)

---

## Conclusion

The proposed "Infinite Grouping, Filtering & Sorting" sprint is **technically achievable** but **not in 5 days**. The calendar's existing filtering architecture is excellent and ready to extend, but grouping is a ground-up feature that requires careful planning and phased rollout.

**Recommendation:**
- **Proceed with reduced scope** (single-level grouping, 2 weeks)
- **OR** focus on enhanced filtering first (2 weeks), grouping later
- **Do NOT rush** the full scope in 1 week - it will create technical debt and regressions

The calendar is a valuable product. Let's build grouping features properly, not quickly.

---

**Reviewed by:** Claude Code Agent
**Full Analysis:** [INFINITE_GROUPING_VIABILITY_ANALYSIS.md](./INFINITE_GROUPING_VIABILITY_ANALYSIS.md)
**Next Steps:** Stakeholder review + scope decision
