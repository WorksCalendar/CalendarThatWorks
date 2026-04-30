import type { AssetTrackerPosition } from './geoTypes'

export interface WorksCalendarMapAdapter {
  mount(container: HTMLElement): void
  updatePositions(positions: readonly AssetTrackerPosition[]): void
  focusPosition(id: string): void
  destroy(): void
}
