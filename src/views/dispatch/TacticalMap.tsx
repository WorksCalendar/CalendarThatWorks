/**
 * Tactical map — fixed-zoom SVG projection of asset positions, route
 * breadcrumbs, and animated conflict pulses at facilities.
 *
 * Routes come pre-resolved on each segment (`seg.route`) by the routing
 * engine in `deriveData`, so the line the map draws and the path the marker
 * rides are one and the same geometry. Ground legs trace a smoothed road
 * corridor; air/sea legs arc. The currently-traveled leg of the focused
 * asset gets the cinematic treatment — a glowing "traveled" trail behind the
 * marker and marching-ants "ahead" path — and the marker itself rides the
 * polyline by distance, facing its heading.
 *
 * Asset-agnostic: works for trucks, planes, vessels, anything with a
 * lat/lng-tagged event stream.
 */
import { useMemo } from 'react';
import { project, DEFAULT_LAYER_BOUNDS } from './projection';
import { assetPositionAt } from './deriveData';
import { splitRoute, type AssetDomain, type RoutePoint } from '../../core/routing';
import { DEFAULT_LAYER_ZOOM, tilesForBounds } from './tileLayer';
import type {
  DispatchAsset,
  DispatchConflict,
  DispatchFacility,
  DispatchSegment,
  DispatchStop,
  MapLayer,
} from './types';

interface Props {
  readonly assets: readonly DispatchAsset[];
  readonly facilities: readonly DispatchFacility[];
  readonly stopsByAsset: ReadonlyMap<string, DispatchStop[]>;
  readonly segmentsByAsset: ReadonlyMap<string, DispatchSegment[]>;
  readonly conflicts: readonly DispatchConflict[];
  readonly selectedDate: Date;
  readonly selectedAsset: string | null;
  readonly onSelectAsset: (id: string) => void;
  readonly layer: MapLayer;
  /** Render an OSM raster tile basemap underneath. Default true. */
  readonly showTiles?: boolean;
  /** Override the slippy-map tile URL ({z}/{x}/{y}). */
  readonly tileUrl?: string;
}

const VW = 1000;
const VH = 800;
const MARGIN = 200;

export function TacticalMap({
  assets,
  facilities,
  stopsByAsset,
  segmentsByAsset,
  conflicts,
  selectedDate,
  selectedAsset,
  onSelectAsset,
  layer,
  showTiles = true,
  tileUrl,
}: Props) {
  const bounds = DEFAULT_LAYER_BOUNDS[layer];
  const proj = (lat: number, lng: number): [number, number] =>
    project(bounds, lat, lng, VW, VH);

  const tiles = useMemo(
    () =>
      showTiles
        ? tilesForBounds(bounds, DEFAULT_LAYER_ZOOM[layer], tileUrl)
        : [],
    [bounds, layer, showTiles, tileUrl],
  );

  const conflictsAtTime = useMemo(() => {
    const dayStart = new Date(
      Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), selectedDate.getUTCDate()),
    );
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    return conflicts.filter((c) => {
      const t = c.timeA.getTime();
      return t >= dayStart.getTime() && t < dayEnd.getTime();
    });
  }, [conflicts, selectedDate]);

  const assetById = useMemo(() => {
    const m = new Map<string, DispatchAsset>();
    for (const a of assets) m.set(a.id, a);
    return m;
  }, [assets]);

  // Position + heading for every asset at the scrubbed time. Rides the
  // resolved route geometry, so the dot tracks the drawn polyline and the
  // glyph can face its direction of travel.
  const samples = useMemo(() => {
    const m = new Map<string, ReturnType<typeof assetPositionAt>>();
    for (const a of assets) {
      m.set(a.id, assetPositionAt(stopsByAsset.get(a.id), segmentsByAsset.get(a.id), selectedDate));
    }
    return m;
  }, [assets, stopsByAsset, segmentsByAsset, selectedDate]);

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-full" style={{ background: '#e8dcc8' }}>
      <defs>
        <filter id="dispatch-ink">
          <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves={2} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={2} />
        </filter>
        {/* Soft drop shadow for arched breadcrumbs to read as lifted above
            the ground plane. */}
        <filter id="dispatch-arch-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation={1.2} />
          <feOffset dy={1.5} result="off" />
          <feComponentTransfer>
            <feFuncA type="linear" slope={0.35} />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Route glow — a wide diffusion in the stroke's own color so the
            active leg's traveled trail reads as a lit fibre across the
            parchment, the "command center" cue. */}
        <filter id="dispatch-route-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={3.5} result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Glow ring for conflict pulses — survives behind the dashed outline
            so the alert reads from across the screen. */}
        <filter id="dispatch-conflict-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={5} result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width={VW} height={VH} fill="#e8dcc8" />

      {/* OSM raster tile basemap — each tile placed by projecting its NW/SE
          corners through the current layer's bounds. */}
      {tiles.length > 0 && (
        <>
          <g>
            {tiles.map((t) => {
              const [x1, y1] = proj(t.nw.lat, t.nw.lng);
              const [x2, y2] = proj(t.se.lat, t.se.lng);
              return (
                <image
                  key={`${t.z}-${t.x}-${t.y}`}
                  href={t.url}
                  x={x1}
                  y={y1}
                  width={x2 - x1}
                  height={y2 - y1}
                  preserveAspectRatio="none"
                  crossOrigin="anonymous"
                  style={{ imageRendering: 'auto' }}
                />
              );
            })}
          </g>
          {/* Faint parchment wash to tie the OSM palette to the theme. */}
          <rect width={VW} height={VH} fill="#e8dcc8" opacity={0.22} />
        </>
      )}

      {/* Layer-name watermark for the non-region zoom presets. */}
      {layer !== 'region' && (
        <text
          x={VW / 2}
          y={36}
          textAnchor="middle"
          fontFamily="serif"
          fontSize={12}
          fill="#5a3e2b"
          letterSpacing={2}
          opacity={0.55}
        >
          {layer.toUpperCase()} VIEW
        </text>
      )}

      {/* ── Route breadcrumbs ──────────────────────────────────────────────
          Each leg draws the geometry resolved by the routing engine
          (`seg.route`). Ground legs trace a smoothed road corridor; air/sea
          legs arc. Legs with no geometry fall back to a quadratic arch.

          Off-screen culling: drop any leg whose endpoints' bounding box sits
          entirely beyond a generous margin — at zoomed-in layers most legs
          are far outside the viewBox and painting them OOMs iOS Safari. */}
      {assets.flatMap((asset) => {
        const segs = segmentsByAsset.get(asset.id) ?? [];
        const isSelected = asset.id === selectedAsset;
        const baseOpacity = selectedAsset ? (isSelected ? 1 : 0.015) : 0.35;
        const sample = samples.get(asset.id) ?? null;
        const activeSeg = sample?.activeSegment;
        return segs.map((seg, i) => {
          const [x1, y1] = proj(seg.from.lat, seg.from.lng);
          const [x2, y2] = proj(seg.to.lat, seg.to.lng);
          if (
            Math.max(x1, x2) < -MARGIN ||
            Math.min(x1, x2) > VW + MARGIN ||
            Math.max(y1, y2) < -MARGIN ||
            Math.min(y1, y2) > VH + MARGIN
          ) {
            return null;
          }
          const past = seg.to.time.getTime() <= selectedDate.getTime();
          const stroke = isSelected ? 2.5 : 1.5;
          const opacity = past
            ? isSelected
              ? 1
              : (0.55 * baseOpacity) / 0.35
            : isSelected
              ? 0.55
              : (0.18 * baseOpacity) / 0.35;

          const d = seg.route
            ? pointsToPath(seg.route.points, proj)
            : archPath(x1, y1, x2, y2);
          const followsGeometry = !!seg.route;
          const isActive = activeSeg === seg;
          // Only spend the cinematic split + glow on legs that matter: the
          // active leg of the focused asset (or any active leg when nothing
          // is selected). Keeps the paint cheap on dense boards.
          const cinematic = isActive && (isSelected || !selectedAsset);

          return (
            <g key={`${asset.id}-${i}`} opacity={opacity}>
              {/* Ground shadow — slim guide along the straight base for arch
                  legs only; geometry-following legs already lay flat. */}
              {!followsGeometry && (isSelected || !selectedAsset) && (
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#3d2b1f"
                  strokeWidth={0.8}
                  strokeDasharray="1,4"
                  opacity={0.25}
                />
              )}
              <path
                d={d}
                fill="none"
                stroke={asset.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={past ? 'none' : '5,4'}
                {...(isSelected && !followsGeometry ? { filter: 'url(#dispatch-arch-shadow)' } : {})}
              />
              {cinematic && seg.route && (
                <CinematicLeg
                  route={seg.route}
                  fraction={sample?.legFraction ?? 0}
                  color={asset.color}
                  proj={proj}
                />
              )}
            </g>
          );
        });
      })}

      {/* Facility anchors */}
      {facilities.map((fac) => {
        const [x, y] = proj(fac.lat, fac.lng);
        return (
          <g key={fac.code} transform={`translate(${x},${y})`}>
            <circle r={8} fill="#fff" stroke="#3d2b1f" strokeWidth={1.5} filter="url(#dispatch-ink)" />
            <text y={-12} textAnchor="middle" fontFamily="serif" fontSize={12} fill="#3d2b1f" fontWeight="bold">
              {fac.code}
            </text>
            {fac.capacity != null && (
              <text y={20} textAnchor="middle" fontFamily="sans-serif" fontSize={8} fill="#5a3e2b">
                {fac.capacity} docks
              </text>
            )}
          </g>
        );
      })}

      {/* Asset markers — position + heading sampled along the route. */}
      {assets.map((asset) => {
        const sample = samples.get(asset.id) ?? null;
        if (!sample) return null;
        const [x, y] = proj(sample.lat, sample.lng);
        const isSelected = asset.id === selectedAsset;
        const color = assetById.get(asset.id)?.color ?? '#3d2b1f';
        return (
          <g
            key={asset.id}
            transform={`translate(${x},${y})`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectAsset(isSelected ? '' : asset.id);
            }}
            style={{ cursor: 'pointer', opacity: selectedAsset ? (isSelected ? 1 : 0.15) : 1 }}
          >
            <title>{`${asset.id} — ${asset.name}\n${sample.moving ? 'En route' : `@ ${sample.facilityCode ?? 'unknown'}`}`}</title>
            <AssetGlyph
              domain={asset.domain}
              color={color}
              moving={sample.moving}
              headingDeg={sample.headingDeg}
              selected={isSelected}
              dimmed={!!selectedAsset && !isSelected}
            />
            {/* Label only on the selected asset — otherwise ids stack into
                typographic confetti. Hover surfaces the id via <title>. */}
            {isSelected && (
              <text y={-18} textAnchor="middle" fontFamily="sans-serif" fontSize={11} fill="#3d2b1f" fontWeight="bold">
                {asset.id}
              </text>
            )}
          </g>
        );
      })}

      {/* Conflict pulses rendered LAST so they overlay every breadcrumb,
          label, and marker. */}
      {(() => {
        const byFac: Record<string, number> = {};
        for (const c of conflictsAtTime) {
          byFac[c.facilityCode] = (byFac[c.facilityCode] ?? 0) + 1;
        }
        return (
          <g filter="url(#dispatch-conflict-glow)">
            {Object.entries(byFac).map(([code, count]) => {
              const fac = facilities.find((f) => f.code === code);
              if (!fac) return null;
              const [x, y] = proj(fac.lat, fac.lng);
              return (
                <g key={`conflict-${code}`}>
                  <circle cx={x} cy={y} r={30} fill="none" stroke="#c0392b" strokeWidth={3} strokeDasharray="5,3" opacity={0.9}>
                    <animate attributeName="r" values="26;34;26" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;0.55;0.9" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={x} cy={y} r={12} fill="#c0392b" opacity={1} stroke="#fff" strokeWidth={2} />
                  <text y={y + 3} x={x} textAnchor="middle" fontSize={10} fill="#fff" fontWeight="bold" fontFamily="sans-serif">
                    {count}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })()}
    </svg>
  );
}

type Proj = (lat: number, lng: number) => [number, number];

/** SVG `M…L…` path tracing projected route points. */
function pointsToPath(points: readonly RoutePoint[], proj: Proj): string {
  if (points.length === 0) return '';
  const [x0, y0] = proj(points[0]!.lat, points[0]!.lng);
  let d = `M ${x0} ${y0}`;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = proj(points[i]!.lat, points[i]!.lng);
    d += ` L ${x} ${y}`;
  }
  return d;
}

/** Quadratic-arch fallback when a leg has no resolved geometry. */
function archPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const archH = Math.min(Math.max(len * 0.22, 12), 80);
  const nx = len === 0 ? 0 : -dy / len;
  const ny = len === 0 ? -1 : dx / len;
  const upBias = ny < 0 ? 1 : -1;
  const cx = (x1 + x2) / 2 + nx * archH * upBias;
  const cy = (y1 + y2) / 2 + ny * archH * upBias;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

/**
 * The cinematic overlay for a leg in progress: a glowing "traveled" trail
 * up to the marker and a marching-ants "ahead" path beyond it, both tracing
 * the real route geometry so the eye follows the asset down the road.
 */
function CinematicLeg({
  route,
  fraction,
  color,
  proj,
}: {
  route: NonNullable<DispatchSegment['route']>;
  fraction: number;
  color: string;
  proj: Proj;
}) {
  const { traveled, remaining } = useMemo(() => splitRoute(route, fraction), [route, fraction]);
  const traveledPath = pointsToPath(traveled, proj);
  const remainingPath = pointsToPath(remaining, proj);
  return (
    <>
      {/* Ahead of the marker — marching ants flowing toward the destination. */}
      <path
        d={remainingPath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="2,6"
        opacity={0.6}
      >
        <animate attributeName="stroke-dashoffset" from="16" to="0" dur="1s" repeatCount="indefinite" />
      </path>
      {/* Behind the marker — a lit trail showing ground already covered. */}
      <path
        d={traveledPath}
        fill="none"
        stroke={color}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#dispatch-route-glow)"
      />
    </>
  );
}

/**
 * Per-domain asset marker. Parked assets read as a simple dot; moving assets
 * gain a heading-rotated token: a chevron "truck" for ground, a swept arc
 * for air, a hull wedge for sea. Selected assets pulse.
 */
function AssetGlyph({
  domain,
  color,
  moving,
  headingDeg,
  selected,
  dimmed,
}: {
  domain: AssetDomain;
  color: string;
  moving: boolean;
  headingDeg: number;
  selected: boolean;
  dimmed: boolean;
}) {
  const baseR = selected ? 12 : dimmed ? 5 : 8;
  return (
    <g>
      {/* Heading chevron — drawn pointing north, rotated to the bearing.
          North is up in this projection so rotate(heading) faces travel. */}
      {moving && (
        <g transform={`rotate(${headingDeg})`}>
          <path
            d={domain === 'sea'
              ? `M 0 ${-baseR - 7} L ${baseR * 0.5} ${-baseR + 2} L ${-baseR * 0.5} ${-baseR + 2} Z`
              : `M 0 ${-baseR - 8} L ${baseR * 0.6} ${-baseR + 1} L 0 ${-baseR - 2} L ${-baseR * 0.6} ${-baseR + 1} Z`}
            fill={color}
            stroke="#fff"
            strokeWidth={0.75}
            opacity={0.95}
          />
        </g>
      )}
      <circle r={baseR} fill={color} stroke="#fff" strokeWidth={selected ? 3 : 2}>
        {selected && <animate attributeName="r" values="10;14;10" dur="1.5s" repeatCount="indefinite" />}
      </circle>
    </g>
  );
}
