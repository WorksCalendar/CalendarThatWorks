/**
 * WorksCalendar — Theme Metadata
 *
 * Theme families × modes: 6 families × { light, dark } = 12 themes.
 *
 *   import { DEFAULT_THEME, normalizeTheme } from 'works-calendar/themes';
 *   <WorksCalendar theme="ops-dark" />
 *
 * Legacy theme names ("aviation", "corporate", "light", …) are still accepted
 * via normalizeTheme(), which maps them onto the new ThemeId space.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ThemeFamily =
  | 'canvas'
  | 'corporate'
  | 'industrial'
  | 'grid'
  | 'ops'
  | 'neon';

export type ThemeMode = 'light' | 'dark';

export type ThemeId = `${ThemeFamily}-${ThemeMode}`;

export interface ThemeFamilyMeta {
  id: ThemeFamily;
  label: string;
  description: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  family: ThemeFamily;
  mode: ThemeMode;
}

// ── Families ─────────────────────────────────────────────────────────────────

export const THEME_FAMILIES = [
  { id: 'canvas',     label: 'Canvas',     description: 'Clean and structured' },
  { id: 'corporate',  label: 'Corporate',  description: 'Business-ready' },
  { id: 'industrial', label: 'Industrial', description: 'Rugged and practical' },
  { id: 'grid',       label: 'Grid',       description: 'Dense and data-focused' },
  { id: 'ops',        label: 'Ops',        description: 'Operations console' },
  { id: 'neon',       label: 'Neon',       description: 'Bold and high-contrast' },
] as const;

// Generate all theme IDs (12 total)
export const THEMES: ThemeId[] = THEME_FAMILIES.flatMap((f) => [
  `${f.id}-light` as ThemeId,
  `${f.id}-dark`  as ThemeId,
]);

// Default — ops-dark is the operations-console look used by the Air EMS demo
export const DEFAULT_THEME: ThemeId = 'ops-dark';

// ── Helpers ──────────────────────────────────────────────────────────────────

export function buildThemeId(family: ThemeFamily, mode: ThemeMode): ThemeId {
  return `${family}-${mode}`;
}

/**
 * Resolve arbitrary input to a canonical ThemeId.
 *
 * Accepts: new-style "family-mode" IDs, legacy single-word theme names
 * ("aviation", "corporate", "light", "dark", "minimal"), or undefined.
 * Anything we don't recognize falls back to DEFAULT_THEME.
 */
export function normalizeTheme(input?: string): ThemeId {
  if (!input) return DEFAULT_THEME;

  const legacyMap: Record<string, ThemeId> = {
    light:     'canvas-light',
    dark:      'canvas-dark',
    aviation:  'ops-dark',
    minimal:   'grid-light',
    corporate: 'corporate-light',
    soft:      'neon-light',
    forest:    'industrial-light',
    ocean:     'corporate-dark',
  };
  if (legacyMap[input]) return legacyMap[input];

  if ((THEMES as string[]).includes(input)) return input as ThemeId;
  return DEFAULT_THEME;
}

// ── Display metadata ─────────────────────────────────────────────────────────
//
// The Setup Wizard, Setup Landing, and Config Panel all render a theme picker
// with a small preview swatch. Each theme needs a label, description, dark
// flag, 5-color preview palette, and a `cssTheme` hint that maps onto the CSS
// theme file currently shipped in src/styles/ (aviation.css, corporate.css,
// forest.css, minimal.css, ocean.css, soft.css). Until this sprint's follow-up
// ships dedicated CSS for every family, multiple ThemeIds fall back to the
// closest existing CSS theme.

export type ThemePreview = {
  bg: string;
  surface: string;
  accent: string;
  text: string;
  border: string;
};

export interface ThemeMeta extends ThemeDefinition {
  label: string;
  description: string;
  dark: boolean;
  preview: ThemePreview;
  cssTheme: string;
}

export const THEME_META: Record<ThemeId, ThemeMeta> = {
  'canvas-light': {
    id: 'canvas-light', family: 'canvas', mode: 'light',
    label: 'Canvas Light',
    description: 'Clean white canvas, blue accent. The default starting point.',
    dark: false,
    preview: { bg: '#ffffff', surface: '#f8fafc', accent: '#3b82f6', text: '#0f172a', border: '#e2e8f0' },
    cssTheme: 'minimal',
  },
  'canvas-dark': {
    id: 'canvas-dark', family: 'canvas', mode: 'dark',
    label: 'Canvas Dark',
    description: 'Slate dark mode. Easy on the eyes, familiar to everyone.',
    dark: true,
    preview: { bg: '#0f172a', surface: '#1e293b', accent: '#3b82f6', text: '#f1f5f9', border: '#334155' },
    cssTheme: 'ocean',
  },
  'corporate-light': {
    id: 'corporate-light', family: 'corporate', mode: 'light',
    label: 'Corporate Light',
    description: 'Professional navy blue. Enterprise dashboards.',
    dark: false,
    preview: { bg: '#ffffff', surface: '#f0f4f8', accent: '#1d4ed8', text: '#0f2040', border: '#c9d4e0' },
    cssTheme: 'corporate',
  },
  'corporate-dark': {
    id: 'corporate-dark', family: 'corporate', mode: 'dark',
    label: 'Corporate Dark',
    description: 'Deep corporate blue with sky accents. Ambient dark.',
    dark: true,
    preview: { bg: '#0a1628', surface: '#0f1f38', accent: '#0ea5e9', text: '#e0f2fe', border: '#1e3a5a' },
    cssTheme: 'ocean',
  },
  'industrial-light': {
    id: 'industrial-light', family: 'industrial', mode: 'light',
    label: 'Industrial Light',
    description: 'Warm cream, burnt orange accent. Field-friendly.',
    dark: false,
    preview: { bg: '#fffbf7', surface: '#fdf6ee', accent: '#c2410c', text: '#2d1f0e', border: '#e8d5c0' },
    cssTheme: 'soft',
  },
  'industrial-dark': {
    id: 'industrial-dark', family: 'industrial', mode: 'dark',
    label: 'Industrial Dark',
    description: 'Warm dark with orange accent. Shop-floor readable.',
    dark: true,
    preview: { bg: '#1a1410', surface: '#2a221c', accent: '#f97316', text: '#f5efe7', border: '#3d312a' },
    cssTheme: 'aviation',
  },
  'grid-light': {
    id: 'grid-light', family: 'grid', mode: 'light',
    label: 'Grid Light',
    description: 'Pure white, typography-first, indigo accent.',
    dark: false,
    preview: { bg: '#ffffff', surface: '#ffffff', accent: '#6366f1', text: '#111827', border: '#f0f0f0' },
    cssTheme: 'minimal',
  },
  'grid-dark': {
    id: 'grid-dark', family: 'grid', mode: 'dark',
    label: 'Grid Dark',
    description: 'High-density dark grid. Data-dense views.',
    dark: true,
    preview: { bg: '#0a0a0a', surface: '#141414', accent: '#818cf8', text: '#fafafa', border: '#1f1f1f' },
    cssTheme: 'aviation',
  },
  'ops-light': {
    id: 'ops-light', family: 'ops', mode: 'light',
    label: 'Ops Light',
    description: 'Daytime ops console. Cyan accent on clean slate.',
    dark: false,
    preview: { bg: '#f8fafc', surface: '#eef2f7', accent: '#0ea5e9', text: '#0f172a', border: '#cbd5e1' },
    cssTheme: 'corporate',
  },
  'ops-dark': {
    id: 'ops-dark', family: 'ops', mode: 'dark',
    label: 'Ops Dark',
    description: 'Instrument-panel aesthetic. Cyan readouts on navy. Monospace.',
    dark: true,
    preview: { bg: '#080c16', surface: '#0d1525', accent: '#00d4ff', text: '#c8e8f0', border: '#1a3a4a' },
    cssTheme: 'aviation',
  },
  'neon-light': {
    id: 'neon-light', family: 'neon', mode: 'light',
    label: 'Neon Light',
    description: 'Cream background, vivid violet accent. Bold but approachable.',
    dark: false,
    preview: { bg: '#fffbf7', surface: '#fdf6ee', accent: '#7c3aed', text: '#2d1f0e', border: '#e8d5c0' },
    cssTheme: 'soft',
  },
  'neon-dark': {
    id: 'neon-dark', family: 'neon', mode: 'dark',
    label: 'Neon Dark',
    description: 'Deep violet dark with magenta accents. Maximum contrast.',
    dark: true,
    preview: { bg: '#0f0a1e', surface: '#1a1033', accent: '#a855f7', text: '#f5ebff', border: '#2d1e4a' },
    cssTheme: 'aviation',
  },
};

/**
 * Resolve a theme prop down to the CSS theme selector the component runtime
 * understands (what goes into `data-wc-theme`). Legacy names pass through
 * as-is so they keep matching the historical CSS files.
 */
export function resolveCssTheme(input?: string): string {
  if (!input) return THEME_META[DEFAULT_THEME].cssTheme;
  const legacyCss = new Set(['light', 'dark', 'aviation', 'corporate', 'soft', 'minimal', 'forest', 'ocean']);
  if (legacyCss.has(input)) return input;
  const id = normalizeTheme(input);
  return THEME_META[id].cssTheme;
}

// ── Back-compat aliases for the public API ───────────────────────────────────

/** @deprecated Use THEMES (ThemeId[]) + THEME_META[id] instead. */
export const THEME_IDS: ThemeId[] = THEMES;

/** @deprecated Use THEME_META instead. */
export const THEMES_BY_ID: Record<ThemeId, ThemeMeta> = THEME_META;
