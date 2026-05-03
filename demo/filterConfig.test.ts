import { describe, expect, it } from 'vitest';
import { buildDefaultFilterSchema } from '../src/filters/filterSchema';
import { CASCADE_FILTER_DEFINITIONS, buildDemoCascadeConfig, isDemoConfigConsistent } from './filterConfig';

const employees = [{ id: 'e1', name: 'One' }];
const assets = [{ id: 'a1', name: 'Asset One' }];

describe('demo filter config generation', () => {
  it('keeps cascade fields aligned with filter schema keys', () => {
    const demoFilterSchema = [
      ...buildDefaultFilterSchema({ employees, assets }),
      ...CASCADE_FILTER_DEFINITIONS.map(def => ({
        key: def.key,
        label: def.label,
        type: 'multi-select' as const,
        operators: ['in', 'not-in'] as const,
      })),
    ];

    const cascadeConfig = buildDemoCascadeConfig({
      region: () => [],
      base: () => [],
      type: () => [],
      subType: () => [],
      shiftPattern: () => [],
      certifications: () => [],
    });

    expect(isDemoConfigConsistent(demoFilterSchema, cascadeConfig)).toBe(true);
  });
});
