/**
 * Public export wrapper that lazy-loads the heavy Excel implementation.
 */
import type { NormalizedEvent } from '../types/events';

export async function exportToExcel(events: NormalizedEvent[], filename = 'calendar-events'): Promise<void> {
  const { exportToExcel: exportImpl } = await import('./excelExport.js');
  return exportImpl(events, filename);
}
