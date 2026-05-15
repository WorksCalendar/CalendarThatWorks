import type { AssetTrackerPosition } from './geoTypes'

export function isValidPosition(pos: AssetTrackerPosition): boolean {
  return (
    Number.isFinite(pos.lat) &&
    Number.isFinite(pos.lon) &&
    pos.lat >= -90 &&
    pos.lat <= 90 &&
    pos.lon >= -180 &&
    pos.lon <= 180 &&
    Number.isFinite(pos.timestamp)
  )
}
