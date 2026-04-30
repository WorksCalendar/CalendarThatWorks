import { describe, expect, it } from 'vitest'
import {
  createAssetTrackerIntegration,
  isValidPosition,
  mapPositionToResourceMeta,
  positionToResourceTrackingMeta,
  type AssetTrackerLikeRegistry,
  type AssetTrackerPosition,
} from '../asset-tracker'

const samplePosition: AssetTrackerPosition = {
  id: 'truck-101',
  lat: 40.7608,
  lon: -111.891,
  altitude: 1300,
  heading: 90,
  speed: 65,
  timestamp: 1714329600,
  source: 'samsara',
  label: 'Truck 101',
}

describe('asset-tracker integration subpath', () => {
  it('validates normalized positions', () => {
    expect(isValidPosition(samplePosition)).toBe(true)
    expect(isValidPosition({ ...samplePosition, lat: 120 })).toBe(false)
  })

  it('maps position to tracking meta through both APIs', () => {
    const direct = positionToResourceTrackingMeta(samplePosition, 1714329660, 120)
    const alias = mapPositionToResourceMeta(samplePosition, 1714329660, 120)
    expect(alias).toEqual(direct)
  })

  it('creates location adapter from registry getById()', () => {
    const registry: AssetTrackerLikeRegistry = {
      getById: (id) => (id === 'truck-101' ? samplePosition : null),
    }
    const integration = createAssetTrackerIntegration(registry, { nowSeconds: () => 1714329660 })
    const loc = integration.locationAdapter.resolve({ id: 'truck-101', name: 'Truck 101' })
    expect(loc).toMatchObject({ lat: 40.7608, lon: -111.891, altitude: 1300, speed: 65 })
    expect((loc?.meta as any).tracking.stale).toBe(false)
  })

  it('supports positions() fallback', () => {
    const registry: AssetTrackerLikeRegistry = { positions: () => [samplePosition] }
    const integration = createAssetTrackerIntegration(registry)
    const loc = integration.locationAdapter.resolve({ id: 'truck-101', name: 'Truck 101' })
    expect(loc?.lat).toBe(40.7608)
  })
})
