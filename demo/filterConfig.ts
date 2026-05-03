import type { FilterField } from '../src/filters/filterSchema';
import type { CascadeConfig } from '../src/ui/CascadePanel';

type CascadeTierId = 'region' | 'base' | 'type' | 'subType' | 'shiftPattern' | 'certifications';

type CascadeDefinition = {
  key: CascadeTierId;
  label: string;
  hint?: string;
  tier: 'cascade' | 'more';
};

export const CASCADE_FILTER_DEFINITIONS: readonly CascadeDefinition[] = [
  { key: 'region', label: 'Region', hint: 'multi-select', tier: 'cascade' },
  { key: 'base', label: 'Base', hint: 'pruned by Region', tier: 'cascade' },
  { key: 'type', label: 'Type', tier: 'cascade' },
  { key: 'subType', label: 'Sub-type', hint: 'pruned by Type', tier: 'cascade' },
  { key: 'shiftPattern', label: 'Shift pattern', tier: 'more' },
  { key: 'certifications', label: 'Certifications', hint: 'matches if any selected cert is held', tier: 'more' },
];

export function buildDemoCascadeConfig(
  getOptionsByTier: Record<CascadeTierId, NonNullable<CascadeConfig['tiers'][number]['getOptions']>>,
): CascadeConfig {
  const toEntry = (def: CascadeDefinition): CascadeConfig['tiers'][number] => ({
    id: def.key,
    label: def.label,
    filterField: def.key,
    ...(def.hint ? { hint: def.hint } : {}),
    getOptions: getOptionsByTier[def.key],
  });

  return {
    tiers: CASCADE_FILTER_DEFINITIONS.filter(d => d.tier === 'cascade').map(toEntry),
    moreOptions: CASCADE_FILTER_DEFINITIONS.filter(d => d.tier === 'more').map(toEntry),
    moreOptionsLabel: 'More options',
  };
}

export function isDemoConfigConsistent(filterSchema: FilterField[], cascadeConfig: CascadeConfig): boolean {
  const schemaKeys = new Set(filterSchema.map(f => f.key));
  return [...cascadeConfig.tiers, ...cascadeConfig.moreOptions]
    .every(entry => entry.id === entry.filterField && schemaKeys.has(entry.filterField));
}
