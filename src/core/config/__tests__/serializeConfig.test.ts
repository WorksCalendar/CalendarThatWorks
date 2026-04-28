/**
 * `serializeConfig` + round-trip via `parseConfig` (#386 wizard).
 */
import { describe, it, expect } from 'vitest'
import { serializeConfig } from '../serializeConfig'
import { parseConfig } from '../parseConfig'
import type { CalendarConfig } from '../calendarConfig'

describe('serializeConfig — section omission', () => {
  it('emits an empty object for an empty config (no noisy stubs)', () => {
    expect(serializeConfig({})).toEqual({})
  })

  it('omits each missing section rather than emitting empty arrays', () => {
    const out = serializeConfig({ profile: 'trucking' })
    expect(out).toEqual({ profile: 'trucking' })
    // Spot-check that no section keys leaked through.
    expect(Object.keys(out)).toEqual(['profile'])
  })
})

describe('serializeConfig — section shapes', () => {
  it('serializes labels as a plain string map', () => {
    expect(serializeConfig({
      labels: { resource: 'Truck', event: 'Load' },
    })).toEqual({ labels: { resource: 'Truck', event: 'Load' } })
  })

  it('serializes resources with all optional fields when present', () => {
    const out = serializeConfig({
      resources: [{
        id: 't1', name: 'Truck 1', type: 'vehicle',
        capabilities: { refrigerated: true, capacity_lbs: 80000 },
        location: { lat: 40.76, lon: -111.89 },
        meta: { vin: 'XYZ' },
      }],
    })
    expect(out).toEqual({
      resources: [{
        id: 't1', name: 'Truck 1', type: 'vehicle',
        capabilities: { refrigerated: true, capacity_lbs: 80000 },
        location: { lat: 40.76, lon: -111.89 },
        meta: { vin: 'XYZ' },
      }],
    })
  })

  it('serializes pools with strategy + type + query in a single pass', () => {
    expect(serializeConfig({
      pools: [{
        id: 'reefers', name: 'Reefers', type: 'query', memberIds: [],
        query: { op: 'eq', path: 'meta.capabilities.refrigerated', value: true },
        strategy: 'closest',
      }],
    })).toEqual({
      pools: [{
        id: 'reefers', name: 'Reefers', type: 'query', memberIds: [],
        query: { op: 'eq', path: 'meta.capabilities.refrigerated', value: true },
        strategy: 'closest',
      }],
    })
  })

  it('discriminates role vs. pool slots in requirements', () => {
    expect(serializeConfig({
      requirements: [{
        eventType: 'load',
        requires: [
          { role: 'driver',    count: 1 },
          { pool: 'any_truck', count: 1 },
        ],
      }],
    })).toEqual({
      requirements: [{
        eventType: 'load',
        requires: [
          { role: 'driver',    count: 1 },
          { pool: 'any_truck', count: 1 },
        ],
      }],
    })
  })
})

describe('serializeConfig + parseConfig — round-trip', () => {
  it('round-trips a fully populated config losslessly', () => {
    const config: CalendarConfig = {
      profile: 'trucking',
      labels: { resource: 'Truck', event: 'Load', location: 'Depot' },
      resourceTypes: [
        { id: 'vehicle', label: 'Truck' },
        { id: 'person',  label: 'Driver' },
      ],
      roles: [
        { id: 'driver',     label: 'Driver' },
        { id: 'dispatcher', label: 'Dispatcher' },
      ],
      resources: [
        {
          id: 't1', name: 'Truck 101', type: 'vehicle',
          capabilities: { refrigerated: true, capacity_lbs: 80000 },
          location: { lat: 40.7608, lon: -111.8910 },
          meta: { vin: 'XYZ' },
        },
      ],
      pools: [
        {
          id: 'nearby_reefers', name: 'Nearby Reefers',
          type: 'query', memberIds: [],
          query: {
            op: 'and',
            clauses: [
              { op: 'eq',     path: 'meta.capabilities.refrigerated', value: true },
              { op: 'within', path: 'meta.location', from: { kind: 'proposed' }, miles: 50 },
            ],
          },
          strategy: 'closest',
        },
      ],
      requirements: [
        {
          eventType: 'load',
          requires: [
            { role: 'driver',           count: 1 },
            { pool: 'nearby_reefers',   count: 1 },
          ],
        },
      ],
      events: [
        {
          id: 'e1', title: 'SLC → Denver',
          start: '2026-04-20T09:00:00Z',
          end:   '2026-04-20T18:00:00Z',
          eventType: 'load',
          resourcePoolId: 'nearby_reefers',
        },
      ],
      settings: { conflictMode: 'block', timezone: 'America/Denver' },
    }

    const wire = serializeConfig(config)
    const json = JSON.parse(JSON.stringify(wire))
    const round = parseConfig(json)

    expect(round.errors).toEqual([])
    expect(round.dropped).toBe(0)
    expect(round.config).toEqual(config)
  })

  it('round-trips an empty config without losing or inventing fields', () => {
    const round = parseConfig(serializeConfig({}))
    expect(round.config).toEqual({})
    expect(round.errors).toEqual([])
  })
})
