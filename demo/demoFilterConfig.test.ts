import { describe, expect, it } from 'vitest';
import { DEMO_CASCADE_CONFIG, DEMO_FILTER_MODEL, DEMO_FILTER_SCHEMA, UNIFIED_CATEGORIES_CONFIG } from './demoFilterConfig';

describe('demo filter model consistency', () => {
  it('every cascade tier references an existing filter field', () => {
    const fieldIds = new Set(DEMO_FILTER_MODEL.fields.map(f => f.key));
    [...DEMO_CASCADE_CONFIG.tiers, ...DEMO_CASCADE_CONFIG.moreOptions].forEach(item => {
      expect(fieldIds.has(item.filterField)).toBe(true);
    });
  });

  it('every cascade option field has stable unique IDs', () => {
    const ids = [...DEMO_CASCADE_CONFIG.tiers, ...DEMO_CASCADE_CONFIG.moreOptions].map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('category IDs are unique', () => {
    const ids = DEMO_FILTER_MODEL.categories.map(category => category.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('generated cascade config and filter schema stay in sync', () => {
    const schemaFields = new Set(DEMO_FILTER_SCHEMA.map(field => field.key));
    [...DEMO_CASCADE_CONFIG.tiers, ...DEMO_CASCADE_CONFIG.moreOptions].forEach(item => {
      expect(schemaFields.has(item.filterField)).toBe(true);
    });
  });
});
