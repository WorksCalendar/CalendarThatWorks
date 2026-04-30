/**
 * MapPeekWidget — inline mini-map + expand-on-click full map.
 *
 * Drops into the right rail's "Region map" section. Renders an
 * always-visible bounding-box-fit SVG plot of every coord-bearing
 * event (dependency-free, no tile layer — same convention the legacy
 * `RegionMapWidget` used). Clicking the mini-map opens a 70vw × 70vh
 * modal that mounts the real `<MapView />` with a MapLibre basemap.
 * Closing the modal returns to the rail preview; the mini never
 * unmounts, so the operator's "where am I" reference stays put.
 */
import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import MapView from '../views/MapView'
import styles from './MapPeekWidget.module.css'

type EventLike = {
  id: string
  title: string
  start: Date | string | number
  end?: Date | string | number
  meta?: Record<string, unknown> | null
}

export interface MapPeekWidgetProps {
  readonly events: readonly EventLike[]
  /** Forwarded to the embedded MapView. */
  readonly onEventClick?: (event: EventLike) => void
  /** MapLibre style URL, forwarded to MapView. */
  readonly mapStyle?: string
}

interface Plotted { id: string; lat: number; lon: number }

function readCoords(ev: EventLike): { lat: number; lon: number } | null {
  const meta = ev.meta
  if (!meta) return null
  const c = meta['coords']
  if (c && typeof c === 'object') {
    const cc = c as Record<string, unknown>
    const lat = cc['lat']; const lon = cc['lon'] ?? cc['lng']
    if (typeof lat === 'number' && typeof lon === 'number') return { lat, lon }
  }
  const lat = meta['lat']; const lon = meta['lon'] ?? meta['lng']
  if (typeof lat === 'number' && typeof lon === 'number') return { lat, lon }
  return null
}

const MINI_W = 200
const MINI_H = 96
const MINI_PAD = 10

export function MapPeekWidget({ events, onEventClick, mapStyle }: MapPeekWidgetProps) {
  const [open, setOpen] = useState(false)

  const plotted = useMemo<Plotted[]>(() => {
    const out: Plotted[] = []
    for (const ev of events) {
      const c = readCoords(ev)
      if (c) out.push({ id: String(ev.id ?? ''), ...c })
    }
    return out
  }, [events])

  // Esc closes the modal — keyboard parity with native dialogs.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const project = useMemo(() => buildProjector(plotted), [plotted])

  return (
    <>
      <div className={styles['host']}>
        <button
          type="button"
          className={styles['mini']}
          onClick={() => setOpen(true)}
          aria-label={`Open map (${plotted.length} events with coordinates)`}
          title="Open map"
        >
          <span className={styles['miniBody']}>
            {plotted.length === 0 ? (
              <span className={styles['miniEmpty']}>No coords yet</span>
            ) : (
              <svg
                className={styles['miniSvg']}
                viewBox={`0 0 ${MINI_W} ${MINI_H}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {plotted.map(p => {
                  const { x, y } = project(p)
                  return <circle key={p.id} cx={x} cy={y} r={2.5} className={styles['miniDot']} />
                })}
              </svg>
            )}
          </span>
        </button>
      </div>

      {open && (
        <div
          className={styles['backdrop']}
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className={styles['modal']}
            onClick={stop}
            role="dialog"
            aria-label="Map"
            aria-modal="true"
          >
            <div className={styles['toolbar']}>
              <span className={styles['title']}>
                Map
                <span className={styles['subtitle']}>
                  {plotted.length} event{plotted.length === 1 ? '' : 's'}
                </span>
              </span>
              <button
                type="button"
                className={styles['iconBtn']}
                onClick={() => setOpen(false)}
                aria-label="Close map"
                title="Close"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <div className={styles['body']}>
              <MapView
                events={events as never}
                {...(onEventClick ? { onEventClick: onEventClick as never } : {})}
                {...(mapStyle ? { mapStyle } : {})}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function buildProjector(points: readonly Plotted[]): (p: { lat: number; lon: number }) => { x: number; y: number } {
  if (points.length === 0) return () => ({ x: MINI_W / 2, y: MINI_H / 2 })
  if (points.length === 1) return () => ({ x: MINI_W / 2, y: MINI_H / 2 })
  const lats = points.map(p => p.lat), lons = points.map(p => p.lon)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLon = Math.min(...lons), maxLon = Math.max(...lons)
  const dLat = maxLat - minLat || 1
  const dLon = maxLon - minLon || 1
  return ({ lat, lon }) => ({
    x: MINI_PAD + ((lon - minLon) / dLon) * (MINI_W - 2 * MINI_PAD),
    y: MINI_PAD + (1 - (lat - minLat) / dLat) * (MINI_H - 2 * MINI_PAD),
  })
}

function stop(e: { stopPropagation: () => void }) { e.stopPropagation() }

export default MapPeekWidget
