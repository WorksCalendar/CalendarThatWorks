/**
 * MapPeekWidget — live mini-map corner widget + expand-on-click full map.
 *
 * Renders an always-visible MapView in a compact slot. Clicking the mini-map
 * opens a 70vw × 70vh modal with a full interactive MapView. The mini map
 * uses pointer-events: none so it's a passive live preview; a transparent
 * overlay button captures the click-to-expand.
 */
import { useEffect, useRef, useState } from 'react'
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
  /** Fires whenever the corner widget toggles its modal open or closed. */
  readonly onOpenChange?: (open: boolean) => void
}

export function MapPeekWidget({ events, onEventClick, mapStyle, onOpenChange }: MapPeekWidgetProps) {
  const [open, setOpen] = useState(false)

  // Notify host on toggle — skip initial mount.
  const lastOpenRef = useRef<boolean | null>(null)
  useEffect(() => {
    if (lastOpenRef.current === null) { lastOpenRef.current = open; return }
    if (lastOpenRef.current === open) return
    lastOpenRef.current = open
    onOpenChange?.(open)
  }, [open, onOpenChange])

  // Esc closes the modal.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const eventsForMap = events as never

  return (
    <>
      <div className={styles['host']} data-wc-map-widget="peek">
        {/* Live mini-map: pointer-events disabled so it's a passive preview.
            The overlay button on top captures click-to-expand. */}
        <div className={styles['miniWrap']}>
          <div className={styles['miniMapLayer']}>
            <MapView
              events={eventsForMap}
              controls={false}
              {...(mapStyle ? { mapStyle } : {})}
            />
          </div>
          <button
            type="button"
            className={styles['miniOverlay']}
            onClick={() => setOpen(true)}
            aria-label="Open map"
            title="Open map"
          />
        </div>
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
                events={eventsForMap}
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

function stop(e: { stopPropagation: () => void }) { e.stopPropagation() }

export default MapPeekWidget
