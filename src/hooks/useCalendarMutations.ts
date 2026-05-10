import { useCallback, useEffect } from 'react';
import { useEventMutations } from './useEventMutations';
import { useScheduleMutations } from './useScheduleMutations';
import { useScheduleTemplates } from './useScheduleTemplates';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseValue = any;

export interface UseCalendarMutationsInput {
  // Templates
  scheduleTemplates: LooseValue;
  scheduleInstantiationLimits: LooseValue;
  scheduleTemplateAdapter: LooseValue;
  onScheduleTemplateAnalytics: LooseValue;
  role: LooseValue;
  ownerCfg: LooseValue;
  businessHours: LooseValue;
  blockedWindows: LooseValue;
  // Engine
  applyEngineOp: LooseValue;
  applyWithRecurringCheck: LooseValue;
  getSavedEventPayload: LooseValue;
  engine: LooseValue;
  engineVer: LooseValue;
  expandedEvents: LooseValue[];
  visibleEvents: LooseValue[];
  undoManager: LooseValue;
  announcerRef: LooseValue;
  sourceStore: LooseValue;
  // Event callbacks
  onEventSave: LooseValue;
  onEventMove: LooseValue;
  onEventResize: LooseValue;
  onEventDelete: LooseValue;
  onEventGroupChange: LooseValue;
  onAvailabilitySave: LooseValue;
  onScheduleSave: LooseValue;
  onEmployeeAction: LooseValue;
  onEventClickProp: LooseValue;
  onDateSelect: LooseValue;
  onImport: LooseValue;
  // Setup-derived
  configuredEmployees: LooseValue[];
  devMode: boolean;
  showAddButton: boolean;
  perms: LooseValue;
  // Modal state setters
  inlineEditTarget: LooseValue;
  setFormEvent: LooseValue;
  setInlineEditTarget: LooseValue;
  setSelectedEvent: LooseValue;
  editModeRef: LooseValue;
  lastClickCoordsRef: LooseValue;
  importFlash: LooseValue;
  setImportOpen: LooseValue;
  setImportMsg: LooseValue;
  setAvailabilityState: LooseValue;
  setScheduleEditorState: LooseValue;
  setScheduleOpen: LooseValue;
}

export function useCalendarMutations({
  scheduleTemplates, scheduleInstantiationLimits, scheduleTemplateAdapter, onScheduleTemplateAnalytics,
  role, ownerCfg, businessHours, blockedWindows,
  applyEngineOp, applyWithRecurringCheck, getSavedEventPayload, engine, engineVer,
  expandedEvents, visibleEvents, undoManager, announcerRef, sourceStore,
  onEventSave, onEventMove, onEventResize, onEventDelete, onEventGroupChange,
  onAvailabilitySave, onScheduleSave, onEmployeeAction, onEventClickProp, onDateSelect, onImport,
  configuredEmployees, devMode, showAddButton, perms,
  inlineEditTarget, setFormEvent, setInlineEditTarget, setSelectedEvent,
  editModeRef, lastClickCoordsRef, importFlash, setImportOpen, setImportMsg,
  setAvailabilityState, setScheduleEditorState, setScheduleOpen,
}: UseCalendarMutationsInput) {
  const {
    templateError, visibleScheduleTemplates, mergedScheduleTemplates,
    buildSchedulePreview, handleScheduleInstantiate,
    handleCreateScheduleTemplate, handleDeleteScheduleTemplate,
  } = useScheduleTemplates({
    scheduleTemplates, scheduleInstantiationLimits, scheduleTemplateAdapter, onScheduleTemplateAnalytics,
    role, isOwner: ownerCfg.isOwner,
    engine: engine as unknown as { state: { events: Map<string, LooseValue> } },
    ownerBusinessHours: ownerCfg.config?.['businessHours'],
    businessHours, blockedWindows,
    applyEngineOp, getSavedEventPayload, onEventSave,
    onInstantiateSuccess: () => setScheduleOpen(false),
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onKeyDown = (e: LooseValue) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const did = undoManager.undo();
        if (did) announcerRef.current?.announce('Undo.');
        return;
      }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        const did = undoManager.redo();
        if (did) announcerRef.current?.announce('Redo.');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undoManager, announcerRef]);

  const {
    emitEventSave, checkEventConflicts,
    handleEventSave, handleEventMove, handleEventResize,
    handleEventGroupChange, handleEventDelete, handleInlineSave, handleInlineDelete,
  } = useEventMutations({
    applyEngineOp, applyWithRecurringCheck, getSavedEventPayload,
    engine, engineVer, expandedEvents,
    onEventSave, onEventMove, onEventResize, onEventDelete, onEventGroupChange,
    ownerConfig: ownerCfg.config,
    inlineEditTarget, setFormEvent, setInlineEditTarget,
  });

  const handleEventClick = useCallback((ev: LooseValue) => {
    if (editModeRef.current) {
      setSelectedEvent(null);
      setInlineEditTarget({ event: ev, x: lastClickCoordsRef.current.x, y: lastClickCoordsRef.current.y });
      return;
    }
    setSelectedEvent(ev);
    onEventClickProp?.(ev);
  }, [onEventClickProp, editModeRef, setSelectedEvent, setInlineEditTarget, lastClickCoordsRef]);

  const {
    handleShiftStatusChange, handleCoverageAssign, handleEmployeeAction,
    handleAvailabilitySave, handleScheduleEditorSave,
  } = useScheduleMutations({
    applyEngineOp, emitEventSave, getSavedEventPayload,
    expandedEvents, configuredEmployees,
    onEventDelete, onAvailabilitySave, onScheduleSave,
    onEmployeeAction: onEmployeeAction as LooseValue,
    ownerConfig: ownerCfg.config,
    setAvailabilityState, setScheduleEditorState,
  });

  const handleImport = useCallback((imported: LooseValue, meta: LooseValue) => {
    onImport?.(imported);
    sourceStore.addSource({ type: 'csv', label: meta?.label ?? 'CSV Import', color: '#8b5cf6', events: imported, importedAt: new Date().toISOString() });
    setImportOpen(false);
    const count = Array.isArray(imported) ? imported.length : 0;
    setImportMsg(`Imported ${count} event${count === 1 ? '' : 's'}`);
    importFlash.trigger();
  }, [onImport, sourceStore, importFlash, setImportOpen, setImportMsg]);

  const handleEditFromHoverCard = useCallback((ev: LooseValue) => {
    setSelectedEvent(null);
    let formEv = ev._raw ?? ev;
    if (ev._recurring && ev._eventId) {
      const master = engine.state.events.get(ev._eventId);
      if (master?.rrule) formEv = { ...formEv, rrule: master.rrule };
    }
    setFormEvent(formEv);
  }, [engine, setSelectedEvent, setFormEvent]);

  const hasAddButton = (showAddButton || ownerCfg.isOwner || devMode) && perms.canAddEvent;
  const hasScheduleTemplatesFlag = Array.isArray(visibleScheduleTemplates) && visibleScheduleTemplates.length > 0;
  const hasImport    = !!(onImport || ownerCfg.isOwner);
  const isEmpty      = visibleEvents.length === 0;

  const handleDateSelect = useCallback((start: LooseValue, end: LooseValue) => {
    if (!hasAddButton) return;
    onDateSelect?.(start, end);
    setFormEvent({ start, end });
  }, [hasAddButton, onDateSelect, setFormEvent]);

  const handleScheduleDateSelect = useCallback((start: LooseValue, end: LooseValue, resourceId: LooseValue) => {
    if (!hasAddButton) return;
    onDateSelect?.(start, end, resourceId);
    const startDate = start instanceof Date ? start : new Date(start);
    const endDate = end instanceof Date ? end : new Date(end);
    const emp = configuredEmployees.find((e: LooseValue) => String(e.id) === String(resourceId));
    if (!emp) { setFormEvent({ start: startDate, end: endDate, resource: resourceId }); return; }
    setScheduleEditorState({ emp, start: startDate, end: endDate });
  }, [configuredEmployees, hasAddButton, onDateSelect, setFormEvent, setScheduleEditorState]);

  const handlePoolDateSelect = useCallback((start: LooseValue, end: LooseValue, poolId: LooseValue) => {
    if (!hasAddButton) return;
    const startDate = start instanceof Date ? start : new Date(start);
    const endDate   = end   instanceof Date ? end   : new Date(end);
    setFormEvent({ start: startDate, end: endDate, resourcePoolId: poolId });
  }, [hasAddButton, setFormEvent]);

  return {
    templateError, visibleScheduleTemplates, mergedScheduleTemplates,
    buildSchedulePreview, handleScheduleInstantiate,
    handleCreateScheduleTemplate, handleDeleteScheduleTemplate,
    emitEventSave, checkEventConflicts,
    handleEventSave, handleEventMove, handleEventResize,
    handleEventGroupChange, handleEventDelete, handleInlineSave, handleInlineDelete,
    handleEventClick, handleEditFromHoverCard, handleImport,
    handleShiftStatusChange, handleCoverageAssign, handleEmployeeAction,
    handleAvailabilitySave, handleScheduleEditorSave,
    hasAddButton, hasScheduleTemplates: hasScheduleTemplatesFlag, hasImport, isEmpty,
    handleDateSelect, handleScheduleDateSelect, handlePoolDateSelect,
  };
}
