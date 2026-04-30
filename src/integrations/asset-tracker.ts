import type { EngineResource } from '../core/engine/schema/resourceSchema'
import type { ResourceLocationAdapter, ResourceLocation } from '../core/pools/locationAdapters'
import type {
  GeoPoint,
  ResourceTrackingMeta,
  AssetTrackerPosition,
} from '../core/geo/geoTypes'
import type { WorksCalendarMapAdapter } from '../core/geo/mapAdapterTypes'
import { isValidPosition } from '../core/geo/positionGuards'
import { positionToResourceTrackingMeta } from '../core/geo/positionToResourceMeta'

export type { GeoPoint, ResourceTrackingMeta, AssetTrackerPosition, WorksCalendarMapAdapter }
export { isValidPosition, positionToResourceTrackingMeta }

export interface AssetTrackerLikeRegistry {
  readonly getById?: (id: string) => AssetTrackerPosition | null | undefined
  readonly positions?: () => Iterable<AssetTrackerPosition>
}

export interface AssetMapIntegrationOptions {
  readonly id?: string
  readonly staleThresholdSeconds?: number
  readonly nowSeconds?: () => number
  readonly resourceIdFromPosition?: (position: AssetTrackerPosition) => string
}

export interface AssetTrackerIntegration {
  readonly locationAdapter: ResourceLocationAdapter
  readonly mapPositionToResourceMeta: (position: AssetTrackerPosition) => ResourceTrackingMeta | null
}

export function mapPositionToResourceMeta(
  position: AssetTrackerPosition,
  nowSeconds: number,
  staleThresholdSeconds: number,
): ResourceTrackingMeta | null {
  return positionToResourceTrackingMeta(position, nowSeconds, staleThresholdSeconds)
}

export function createAssetTrackerIntegration(
  registry: AssetTrackerLikeRegistry,
  options: AssetMapIntegrationOptions = {},
): AssetTrackerIntegration {
  const staleThresholdSeconds = options.staleThresholdSeconds ?? 120
  const nowSeconds = options.nowSeconds ?? (() => Math.floor(Date.now() / 1000))
  const resourceIdFromPosition = options.resourceIdFromPosition ?? ((p: AssetTrackerPosition) => p.id)

  const byResourceId = (): ReadonlyMap<string, AssetTrackerPosition> => {
    const map = new Map<string, AssetTrackerPosition>()
    if (typeof registry.positions === 'function') {
      for (const pos of registry.positions()) {
        map.set(resourceIdFromPosition(pos), pos)
      }
    }
    return map
  }

  return {
    locationAdapter: {
      id: options.id ?? 'asset-tracker',
      resolve(resource: EngineResource): ResourceLocation | null {
        const pos = lookupPosition(registry, resource.id, byResourceId())
        if (!pos || !isValidPosition(pos)) return null
        return {
          lat: pos.lat,
          lon: pos.lon,
          ...(pos.altitude != null ? { altitude: pos.altitude } : {}),
          ...(pos.heading != null ? { heading: pos.heading } : {}),
          ...(pos.speed != null ? { speed: pos.speed } : {}),
          timestamp: pos.timestamp,
          source: pos.source,
          meta: {
            tracking: mapPositionToResourceMeta(pos, nowSeconds(), staleThresholdSeconds),
            label: pos.label,
            ...(pos.meta ? { upstream: pos.meta } : {}),
          },
        }
      },
    },
    mapPositionToResourceMeta: (position) =>
      mapPositionToResourceMeta(position, nowSeconds(), staleThresholdSeconds),
  }
}

function lookupPosition(
  registry: AssetTrackerLikeRegistry,
  resourceId: string,
  indexed: ReadonlyMap<string, AssetTrackerPosition>,
): AssetTrackerPosition | null {
  if (typeof registry.getById === 'function') return registry.getById(resourceId) ?? null
  return indexed.get(resourceId) ?? null
}
