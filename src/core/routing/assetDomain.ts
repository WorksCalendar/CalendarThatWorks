/**
 * Map a loose travel-mode string (off `event.meta.travelMode` or
 * `asset.meta.travelMode`) to the physical {@link AssetDomain} that drives
 * route geometry + map rendering.
 *
 * Travel *profiles* (car / walking / aircraft, see `core/travel`) answer
 * "how long does this leg take"; the *domain* answers "through what medium",
 * which is what the map needs to pick a glyph and a path strategy. They
 * overlap but aren't identical — hence a small dedicated resolver rather
 * than overloading the profile enum.
 */
import type { AssetDomain } from './types';

/** Recognized sea-mode keywords (vessels travel across water). */
const SEA_MODES = new Set([
  'sea', 'ship', 'boat', 'vessel', 'ferry', 'barge', 'tug', 'maritime', 'ocean',
]);

/** Recognized air-mode keywords (aircraft profile ids included). */
const AIR_MODES = new Set([
  'air', 'aircraft', 'plane', 'flight', 'helicopter', 'heli',
  'light-piston', 'turboprop', 'business-jet', 'airliner',
]);

/**
 * Resolve an {@link AssetDomain} from a mode string. Unknown / missing
 * values fall back to `ground` — the dispatch default and the safest visual
 * (a marker on the map plane rather than a floating arc).
 */
export function resolveAssetDomain(mode: string | null | undefined): AssetDomain {
  if (!mode) return 'ground';
  const m = mode.trim().toLowerCase();
  if (AIR_MODES.has(m)) return 'air';
  if (SEA_MODES.has(m)) return 'sea';
  return 'ground';
}
