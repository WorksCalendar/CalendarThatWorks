import { Bookmark, Filter, Settings } from 'lucide-react';
import { LeftRail } from './LeftRail';
import { RightPanel, RightPanelSection, CrewOnShiftList } from './RightPanel';
import { MapPeekWidget } from './MapPeekWidget';
import { isScheduleWorkflowEvent } from '../core/scheduleModel';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseValue = any;

interface CalendarLeftRailProps {
  ownerCfg: LooseValue;
  leftRailExtras: LooseValue;
  setSidebarInitialTab: LooseValue;
  setSidebarOpen: (v: boolean) => void;
}

export function CalendarLeftRail({ ownerCfg, leftRailExtras, setSidebarInitialTab, setSidebarOpen }: CalendarLeftRailProps) {
  return (
    <LeftRail
      actions={[
        { id: 'saved-views', label: 'Saved views', hint: 'Manage your view library', icon: <Bookmark size={18} aria-hidden="true" />, onClick: () => { setSidebarInitialTab('saved'); setSidebarOpen(true); } },
        { id: 'focus', label: 'Focus filters', hint: 'Narrow the calendar by region, base, role, or category', icon: <Filter size={18} aria-hidden="true" />, onClick: () => { setSidebarInitialTab('focus'); setSidebarOpen(true); } },
        ...(ownerCfg.isOwner ? [{ id: 'settings', label: 'Settings', hint: 'Calendar configuration', icon: <Settings size={18} aria-hidden="true" />, onClick: () => ownerCfg.setConfigOpen(true) }] : []),
        ...(leftRailExtras ?? []).filter((extra: LooseValue) => !['saved-views', 'focus', 'settings'].includes(extra.id)),
      ]}
    />
  );
}

interface CalendarRightPanelProps {
  showMapWidget: boolean;
  expandedEvents: LooseValue[];
  handleEventClick: LooseValue;
  onMapWidgetOpenChange: LooseValue;
  mapStyle: LooseValue;
  configuredEmployees: LooseValue[];
  onShiftIds: LooseValue;
  rightPanelExtras: LooseValue;
}

export function CalendarRightPanel({
  showMapWidget, expandedEvents, handleEventClick,
  onMapWidgetOpenChange, mapStyle, configuredEmployees, onShiftIds, rightPanelExtras,
}: CalendarRightPanelProps) {
  return (
    <RightPanel>
      {showMapWidget && (
        <RightPanelSection title="Region map">
          <MapPeekWidget
            events={(expandedEvents as LooseValue[]).filter(ev => !isScheduleWorkflowEvent(ev)) as never}
            onEventClick={handleEventClick as never}
            {...(onMapWidgetOpenChange ? { onOpenChange: onMapWidgetOpenChange } : {})}
            {...(mapStyle ? { mapStyle } : {})}
          />
        </RightPanelSection>
      )}
      <RightPanelSection title="Crew on shift">
        <CrewOnShiftList employees={configuredEmployees} onShiftIds={onShiftIds} />
      </RightPanelSection>
      {rightPanelExtras}
    </RightPanel>
  );
}
