/**
 * Travel-mode "time to arrive" estimation for the resource scheduler.
 *
 * - `travelProfiles` — car / walking / aircraft profiles + the estimator.
 * - `travelFeasibility` — the mode-aware sibling of `evaluateGeoConflicts`.
 */
export * from './travelProfiles';
export * from './travelFeasibility';
