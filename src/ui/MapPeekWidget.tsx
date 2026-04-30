/**
 * MapPeekWidget — chrome-level situational-awareness overlay.
 *
 * Replaces the prior `'map'` view tab. Sits in the calendar's
 * upper-right corner as a tiny pill (peek), expands on click into a
 * 360x280 floating card (panel), and from there to fullscreen ops
 * mode. Closing returns to peek so the workspace below is never
 * blocked for users who didn't ask for the map.
 *
 * Reads coordinate-bearing events out of the same `meta.coords`
 * convention `MapView` uses, so any host that already populates it
 * gets the widget for free.
 */
import { useMemo, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { Map as MapIcon, Maximize2, Minimize2, X } from 'lucide-react'
import MapView from '../views/MapView'
import styles from './MapPeekWidget.module.css'

type WidgetMode = 'peek' | 'panel' | 'fullscreen'

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

function hasCoords(ev: EventLike): boolean {
  const meta = ev.meta
  if (!meta) return false
  const c = meta['coords']
  if (c && typeof c === 'object') {
    const cc = c as Record<string, unknown>
    if (typeof cc['lat'] === 'number' && (typeof cc['lon'] === 'number' || typeof cc['lng'] === 'number')) {
      return true
    }
  }
  if (typeof meta['lat'] === 'number' && (typeof meta['lon'] === 'number' || typeof meta['lng'] === 'number')) {
    return true
  }
  return false
}

export function MapPeekWidget({ events, onEventClick, mapStyle }: MapPeekWidgetProps) {
  const [mode, setMode] = useState<WidgetMode>('peek')
  const plottable = useMemo(() => events.filter(hasCoords), [events])

  if (mode === 'peek') {
    return (
      <div className={styles['host']}>
        <button
          type="button"
          className={styles['peek']}
          onClick={() => setMode('panel')}
          aria-label={`Open map (${plottable.length} events with coordinates)`}
          title="Open map"
        >
          <MapIcon size={14} aria-hidden="true" />
          <span>Map</span>
          <span className={styles['peekCount']}>· {plottable.length}</span>
        </button>
      </div>
    )
  }

  const isFullscreen = mode === 'fullscreen'
  const containerClass = isFullscreen ? styles['fullscreen'] : styles['host']
  const innerClass = isFullscreen ? styles['fullscreen'] : styles['panel']

  // When in panel mode, the host wrapper is absolutely positioned in
  // the corner; in fullscreen, the wrapper takes over the viewport
  // (position: fixed, inset: 0). The inner shell carries the chrome.
  const wrapperStyle: CSSProperties | undefined = isFullscreen ? undefined : { position: 'absolute', top: 12, right: 12 }

  return (
    <div className={containerClass} style={wrapperStyle} role="dialog" aria-label="Map">
      <div className={innerClass}>
        <div className={styles['toolbar']}>
          <span className={styles['title']}>
            <MapIcon size={13} aria-hidden="true" /> Map
            <span className={styles['subtitle']}>
              {plottable.length} event{plottable.length === 1 ? '' : 's'}
            </span>
          </span>
          {!isFullscreen ? (
            <ToolbarButton label="Expand to fullscreen" onClick={() => setMode('fullscreen')}>
              <Maximize2 size={12} aria-hidden="true" />
            </ToolbarButton>
          ) : (
            <ToolbarButton label="Restore panel" onClick={() => setMode('panel')}>
              <Minimize2 size={12} aria-hidden="true" />
            </ToolbarButton>
          )}
          <ToolbarButton label="Close map" onClick={() => setMode('peek')}>
            <X size={12} aria-hidden="true" />
          </ToolbarButton>
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
  )
}

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={styles['iconBtn']} onClick={onClick} aria-label={label} title={label}>
      {children}
    </button>
  )
}

export default MapPeekWidget
