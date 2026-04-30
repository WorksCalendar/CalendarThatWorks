import type { AssetTrackerPosition, ResourceTrackingMeta } from './geoTypes'
import { isValidPosition } from './positionGuards'

export function positionToResourceTrackingMeta(
  pos: AssetTrackerPosition,
  nowSeconds: number,
  staleThresholdSeconds: number,
): ResourceTrackingMeta | null {
  if (!isValidPosition(pos)) return null

  return {
    location: {
      lat: pos.lat,
      lon: pos.lon,
    },
    altitudeFt: pos.altitude,
    heading: pos.heading,
    speedKt: pos.speed,
    timestamp: pos.timestamp,
    source: pos.source,
    label: pos.label,
    stale: nowSeconds - pos.timestamp > staleThresholdSeconds,
  }
}
