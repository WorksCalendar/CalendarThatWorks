/**
 * asset-tracker bridge — pins the integration with Map_Idea's
 * normalized position schema (issue #386).
 *
 * We don't import the real `asset-tracker` package; the bridge
 * accepts a structural type so any registry that exposes `getById`
 * or `positions()` works. These tests fake a registry to verify
 * both code paths.
 */
import { describe, it, expect } from 'vitest'
import {
  fromAssetTrackerRegistry,
  type AssetTrackerLikeRegistry,
  type AssetTrackerPosition,
} from '../asset-tracker'
import { attachLocations } from '../../core/pools/locationAdapters'
import type { EngineResource } from '../../core/engine/schema/resourceSchema'

const r = (id: string): EngineResource => ({ id, name: id, meta: {} } as EngineResource)

const samplePosition: AssetTrackerPosition = {
  id: 'truck-101',
  lat: 40.7608, lon: -111.8910,
  altitude: 1300, heading: 90, speed: 65,
  timestamp: 1714329600,
  source: 'samsara',
  label: 'Truck 101',
  meta: { vin: 'XYZ' },
}

describe('fromAssetTrackerRegistry', () => {
  it('uses getById when available (preferred O(1) path)', () => {
    const registry: AssetTrackerLikeRegistry = {
      getById: (id) => id === 'truck-101' ? samplePosition : null,
    }
    const adapter = fromAssetTrackerRegistry(registry)
    expect(adapter.id).toBe('asset-tracker')

    const resolved = adapter.resolve(r('truck-101'))
    expect(resolved).toMatchObject({
      lat: 40.7608, lon: -111.8910, altitude: 1300, heading: 90,
      speed: 65, source: 'samsara', timestamp: 1714329600,
      meta: { vin: 'XYZ' },
    })

    expect(adapter.resolve(r('truck-999'))).toBeNull()
  })

  it('falls back to positions() iteration when getById is absent', () => {
    const registry: AssetTrackerLikeRegistry = {
      positions: () => [samplePosition],
    }
    const adapter = fromAssetTrackerRegistry(registry)
    const resolved = adapter.resolve(r('truck-101'))
    expect(resolved).toMatchObject({ lat: 40.7608, lon: -111.8910 })
    expect(adapter.resolve(r('truck-999'))).toBeNull()
  })

  it('honors a custom adapter id when multiple feeds are wired', () => {
    const adapter = fromAssetTrackerRegistry(
      { positions: () => [] },
      { id: 'fleet-east' },
    )
    expect(adapter.id).toBe('fleet-east')
  })

  it('omits optional fields when the upstream position omits them', () => {
    const registry: AssetTrackerLikeRegistry = {
      getById: () => ({ id: 'minimal', lat: 0, lon: 0 }),
    }
    const resolved = fromAssetTrackerRegistry(registry).resolve(r('minimal'))
    expect(resolved).toEqual({ lat: 0, lon: 0 })
    // No altitude/heading/speed/timestamp/source/meta keys when not provided.
    expect(Object.keys(resolved!).sort()).toEqual(['lat', 'lon'])
  })

  it('plugs into attachLocations end-to-end', () => {
    const registry: AssetTrackerLikeRegistry = {
      getById: (id) => id === 'truck-101' ? samplePosition : null,
    }
    const result = attachLocations(
      [r('truck-101'), r('truck-202')],
      [fromAssetTrackerRegistry(registry)],
    )
    expect((result[0]!.meta as any).location.lat).toBe(40.7608)
    expect((result[1]!.meta as any).location).toBeUndefined()
  })
})
