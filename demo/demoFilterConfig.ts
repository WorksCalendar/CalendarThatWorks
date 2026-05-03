import { DEFAULT_CATEGORIES } from '../src/index.ts';
import { buildDefaultFilterSchema } from '../src/filters/filterSchema';
import {
  regions,
  bases,
  assets as EMS_ASSETS,
  crew,
  dispatchers,
  medicalCrew,
  mechanics,
} from './emsData';

const DISPATCH_COLOR = '#6366f1';
const PILOT_COLOR = '#3b82f6';
const MEDICAL_COLOR = '#14b8a6';
const MECHANIC_COLOR = '#f59e0b';
const MISSION_COLOR = '#a855f7';
const MAINT_COLOR = '#f97316';
const REQUEST_COLOR = '#10b981';

const ALL_EMPLOYEES = [...dispatchers, ...crew, ...medicalCrew, ...mechanics];
const EMPLOYEE_BY_ID = new Map(ALL_EMPLOYEES.map(e => [e.id, e]));
const AIRCRAFT_BY_ID = new Map(EMS_ASSETS.map(a => [a.id, a]));
const BASE_REGION_BY_ID = new Map(bases.map(b => [b.id, b.regionId]));

function resolveEventBase(ev: any) {
  const emp = EMPLOYEE_BY_ID.get(ev.resource);
  if (emp) return emp.basedAt;
  const ac = AIRCRAFT_BY_ID.get(ev.resource);
  if (ac) return ac.basedAt;
  return ev.basedAt ?? null;
}
function resolveEventRegion(ev: any) {
  const baseId = resolveEventBase(ev);
  return baseId ? BASE_REGION_BY_ID.get(baseId) ?? null : null;
}
function resolveEventType(ev: any) {
  if (AIRCRAFT_BY_ID.has(ev.resource)) return 'asset';
  const emp = EMPLOYEE_BY_ID.get(ev.resource);
  if (!emp) return null;
  return emp.role === 'dispatcher' ? 'base' : 'crew';
}
function resolveEventSubType(ev: any) {
  const emp = EMPLOYEE_BY_ID.get(ev.resource);
  if (emp) {
    switch (emp.role) {
      case 'pilot': return 'pilot';
      case 'rn':
      case 'rt':
      case 'medic': return 'medical';
      case 'mechanic': return 'maintenance';
      case 'dispatcher': return 'dispatch';
      default: return null;
    }
  }
  const ac = AIRCRAFT_BY_ID.get(ev.resource);
  if (ac) return ac.type === 'helicopter' ? 'helicopter' : 'fixed-wing';
  return null;
}
function resolveEventShiftPattern(ev: any) {
  const emp = EMPLOYEE_BY_ID.get(ev.resource);
  return emp ? emp.shiftType : null;
}
function resolveEventCertifications(ev: any) {
  const emp = EMPLOYEE_BY_ID.get(ev.resource);
  return emp ? emp.certifications : [];
}
function valueHas(value: unknown, key: unknown) {
  if (key == null) return false;
  return value instanceof Set ? value.has(key) : Array.isArray(value) && value.includes(key as never);
}

const getTypeOptions = () => [
  { value: 'crew', label: 'Crew' },
  { value: 'base', label: 'Base' },
  { value: 'asset', label: 'Asset' },
];
const SUBTYPE_BY_TYPE = {
  crew: ['pilot', 'medical', 'maintenance'],
  base: ['dispatch'],
  asset: ['helicopter', 'fixed-wing'],
} as const;
const SUBTYPE_LABELS: Record<string, string> = {
  pilot: 'Pilot', medical: 'Medical', maintenance: 'Maintenance', dispatch: 'Dispatch', helicopter: 'Helicopter', 'fixed-wing': 'Fixed-wing',
};
const getShiftPatternOptions = () => [
  { value: 'day', label: 'Day' },
  { value: 'night', label: 'Night' },
  { value: 'on-call', label: 'On call' },
];
const getCertificationOptions = () => {
  const seen = new Set<string>();
  ALL_EMPLOYEES.forEach(e => e.certifications.forEach(c => seen.add(c)));
  return [...seen].sort().map(c => ({ value: c, label: c }));
};


type DemoField = {
  key: string;
  label: string;
  predicate: (item: any, value: any) => boolean;
  getOptions: (sel?: any) => Array<{ value: string; label: string }>;
};
type DemoCascadeItem = { id: string; hint?: string; getOptions?: (sel: any) => Array<{ value: string; label: string }> };

export const DEMO_FILTER_MODEL = {
  categories: [
    { id: 'dispatch-shift', label: 'Dispatch', color: DISPATCH_COLOR },
    { id: 'pilot-shift', label: 'Pilot Shift', color: PILOT_COLOR },
    { id: 'medical-shift', label: 'Medical Shift', color: MEDICAL_COLOR },
    { id: 'mechanic-shift', label: 'Mechanic Shift', color: MECHANIC_COLOR },
    { id: 'on-call', label: 'On Call', color: MECHANIC_COLOR },
    { id: 'pto', label: 'PTO', color: '#94a3b8' },
    { id: 'mission-assignment', label: 'Mission', color: MISSION_COLOR },
    { id: 'maintenance', label: 'Maintenance', color: MAINT_COLOR },
    { id: 'training', label: 'Training', color: '#f59e0b' },
    { id: 'aircraft-request', label: 'Aircraft Request', color: REQUEST_COLOR },
    { id: 'asset-request', label: 'Asset Request', color: REQUEST_COLOR },
    { id: 'base-event', label: 'Base Event', color: '#64748b' },
  ],
  fields: [
    { key: 'region', label: 'Region', predicate: (item: any, value: any) => valueHas(value, resolveEventRegion(item)), getOptions: () => regions.map(r => ({ value: r.id, label: r.name })) },
    { key: 'base', label: 'Base', predicate: (item: any, value: any) => valueHas(value, resolveEventBase(item)), getOptions: () => bases.map(b => ({ value: b.id, label: b.name })) },
    { key: 'type', label: 'Type', predicate: (item: any, value: any) => valueHas(value, resolveEventType(item)), getOptions: getTypeOptions },
    { key: 'subType', label: 'Sub-type', predicate: (item: any, value: any) => valueHas(value, resolveEventSubType(item)), getOptions: () => Object.values(SUBTYPE_BY_TYPE).flat().map(v => ({ value: v, label: SUBTYPE_LABELS[v] ?? v })) },
    { key: 'shiftPattern', label: 'Shift pattern', predicate: (item: any, value: any) => valueHas(value, resolveEventShiftPattern(item)), getOptions: getShiftPatternOptions },
    { key: 'certifications', label: 'Certifications', predicate: (item: any, value: any) => {
      const certs = resolveEventCertifications(item);
      if (!certs || certs.length === 0) return false;
      if (value instanceof Set) return certs.some((c: string) => value.has(c));
      return Array.isArray(value) && certs.some((c: string) => value.includes(c));
    }, getOptions: getCertificationOptions },
  ] as DemoField[],
  cascade: {
    tiers: [
      { id: 'region', hint: 'multi-select' },
      { id: 'base', hint: 'pruned by Region', getOptions: (sel: any) => {
        const regionFilter = sel.region ?? [];
        return bases.filter(b => regionFilter.length === 0 || regionFilter.includes(b.regionId)).map(b => ({ value: b.id, label: b.name }));
      } },
      { id: 'type' },
      { id: 'subType', hint: 'pruned by Type', getOptions: (sel: any) => {
        const typeFilter = sel.type ?? [];
        const allowed = typeFilter.length === 0 ? Object.values(SUBTYPE_BY_TYPE).flat() : typeFilter.flatMap((t: string) => SUBTYPE_BY_TYPE[t as keyof typeof SUBTYPE_BY_TYPE] ?? []);
        return allowed.map((v: string) => ({ value: v, label: SUBTYPE_LABELS[v] ?? v }));
      } },
    ] as DemoCascadeItem[],
    moreOptions: [
      { id: 'shiftPattern' },
      { id: 'certifications', hint: 'matches if any selected cert is held' },
    ] as DemoCascadeItem[],
  },
};

const fieldById = new Map(DEMO_FILTER_MODEL.fields.map(f => [f.key, f]));

export const UNIFIED_CATEGORIES_CONFIG = {
  categories: [...DEMO_FILTER_MODEL.categories, ...DEFAULT_CATEGORIES],
  pillStyle: 'hue',
  defaultCategoryId: 'other',
};

export const DEMO_FILTER_SCHEMA = [
  ...buildDefaultFilterSchema({ employees: [...dispatchers, ...crew, ...medicalCrew, ...mechanics], assets: EMS_ASSETS }).map(f =>
    f.key === 'categories' || f.key === 'resources' || f.key === 'sources' ? { ...f, groupable: false } : f),
  ...DEMO_FILTER_MODEL.fields.map(field => ({
    key: field.key,
    label: field.label,
    type: 'multi-select',
    operators: ['in', 'not-in'],
    groupable: false,
    predicate: field.predicate,
    getOptions: field.getOptions,
  })),
];

export const DEMO_CASCADE_CONFIG = {
  tiers: DEMO_FILTER_MODEL.cascade.tiers.map(tier => {
    const field = fieldById.get(tier.id)!;
    return {
      id: tier.id,
      label: field.label,
      filterField: field.key,
      ...(tier.hint ? { hint: tier.hint } : {}),
      getOptions: tier.getOptions ?? field.getOptions,
    };
  }),
  moreOptions: DEMO_FILTER_MODEL.cascade.moreOptions.map(opt => {
    const field = fieldById.get(opt.id)!;
    return {
      id: opt.id,
      label: field.label,
      filterField: field.key,
      ...(opt.hint ? { hint: opt.hint } : {}),
      getOptions: field.getOptions,
    };
  }),
  moreOptionsLabel: 'More options',
};
