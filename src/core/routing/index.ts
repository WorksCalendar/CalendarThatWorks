/**
 * Self-contained routing engine for the dispatch map.
 *
 * - `types`            — RoutePoint / RouteGeometry / RouteProvider + AssetDomain.
 * - `geometry`         — distance math, Catmull-Rom smoothing, sampling, splitting.
 * - `assetDomain`      — travel-mode → ground/air/sea resolver.
 * - `basicRouteEngine` — the built-in, network-free default provider.
 */
export * from './types';
export * from './geometry';
export * from './assetDomain';
export * from './basicRouteEngine';
