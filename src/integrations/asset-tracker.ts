/**
 * `asset-tracker` bridge — issue #386 v2 distance.
 *
 * Wraps a [`asset-tracker`](https://github.com/natehorst240-sketch/Map_Idea)
 * `PositionPluginRegistry` (or any object that exposes a
 * `Position[]`-shaped iterable keyed by `id`) as a
 * `ResourceLocationAdapter`, so a host that already feeds ADS-B /
 * NMEA / Traccar / APRS / Samsara / MQTT through the tracker can
 * point WorksCalendar's pool resolver at it without writing any
 * glue code.
 *
 * Why this lives in `src/integrations/`: the tracker is an optional
 * peer dependency. WorksCalendar's main bundle stays free of any
 * tracker-specific code; consumers reach for this path only when
 * they install both packages. We don't import the tracker package
 * here either — the bridge accepts a structural type so it works
 * whether the host is using the published `asset-tracker` package,
 * a fork, or a hand-rolled registry that happens to match the
 * normalized-position shape.
 */
import type { ResourceLocationAdapter, ResourceLocation } from '../core/pools/locationAdapters'

/**
 * The minimum surface from `asset-tracker` we depend on. The real
 * package's `PositionPluginRegistry` exposes much more — we only
 * need a way to look up the latest normalized position for a given
 * resource id. Two lookup styles are supported so this bridge fits
 * whichever shape the upstream package settles on:
 *
 *   - `getById(id)` returning the position (preferred — O(1))
 *   - `positions()` returning the whole list (fallback — O(n))
 */
export interface AssetTrackerLikeRegistry {
  readonly getById?: (id: string) => AssetTrackerPosition | null | undefined
  readonly positions?: () => Iterable<AssetTrackerPosition>
}

export interface AssetTrackerPosition {
  readonly id: string
  readonly lat: number
  readonly lon: number
  readonly altitude?: number | null
  readonly heading?: number | null
  readonly speed?: number | null
  readonly timestamp?: number
  readonly source?: string
  readonly label?: string
  readonly meta?: Readonly<Record<string, unknown>>
}

export interface FromAssetTrackerOptions {
  /** Override the adapter id; useful when you have multiple feeds. */
  readonly id?: string
}

/**
 * Build a `ResourceLocationAdapter` backed by an asset-tracker-style
 * registry.
 *
 *   import { buildRegistry, adsbAdapter } from 'asset-tracker';
 *   import { fromAssetTrackerRegistry, attachLocations } from 'works-calendar';
 *
 *   const registry  = buildRegistry([adsbAdapter()]);
 *   await registry.refresh();   // host owns the polling cadence
 *   const located   = attachLocations(resources, [
 *     fromAssetTrackerRegistry(registry),
 *   ]);
 *
 * The adapter reads from the registry on each `resolve` call —
 * cheap when `getById` is available; the host should call this
 * helper once per registry refresh tick, not per resolve.
 */
export function fromAssetTrackerRegistry(
  registry: AssetTrackerLikeRegistry,
  options: FromAssetTrackerOptions = {},
): ResourceLocationAdapter {
  return {
    id: options.id ?? 'asset-tracker',
    resolve(resource) {
      const pos = lookup(registry, resource.id)
      return pos ? toLocation(pos) : null
    },
  }
}

// ─── Internals ────────────────────────────────────────────────────────────

function lookup(reg: AssetTrackerLikeRegistry, id: string): AssetTrackerPosition | null {
  if (typeof reg.getById === 'function') {
    return reg.getById(id) ?? null
  }
  if (typeof reg.positions === 'function') {
    for (const p of reg.positions()) {
      if (p.id === id) return p
    }
  }
  return null
}

function toLocation(p: AssetTrackerPosition): ResourceLocation {
  // Map_Idea's normalized schema is already a strict superset of our
  // `ResourceLocation` — pass it through unchanged so altitude /
  // heading / speed / timestamp / source / meta survive into
  // `resource.meta.location` for downstream consumers.
  return {
    lat: p.lat,
    lon: p.lon,
    ...(p.altitude  != null ? { altitude:  p.altitude  } : {}),
    ...(p.heading   != null ? { heading:   p.heading   } : {}),
    ...(p.speed     != null ? { speed:     p.speed     } : {}),
    ...(p.timestamp != null ? { timestamp: p.timestamp } : {}),
    ...(p.source    != null ? { source:    p.source    } : {}),
    ...(p.meta      != null ? { meta:      p.meta      } : {}),
  }
}
