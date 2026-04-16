/**
 * WorksCalendar — Theme Metadata
 *
 * Import this to get all available themes with display info and preview colors.
 *
 * Usage:
 *   import { THEMES } from 'works-calendar/themes';
 *   // or for a specific theme CSS:
 *   import 'works-calendar/styles/aviation';
 *   <WorksCalendar theme="aviation" />
 */

export const THEMES = [
  {
    id: 'light',
    label: 'Default',
    description: 'Clean modern light theme. Blue accent on white.',
    dark: false,
    preview: { bg: '#ffffff', surface: '#f8fafc', accent: '#3b82f6', text: '#0f172a', border: '#e2e8f0' },
    customTheme: {
      colors: {
        accent: '#3b82f6', accentDim: '#eff6ff',
        bg: '#ffffff', surface: '#f8fafc', surface2: '#f1f5f9',
        border: '#e2e8f0', borderDark: '#cbd5e1',
        text: '#0f172a', textMuted: '#64748b',
      },
      typography: { fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
      borders: { radius: 10, radiusSm: 6 },
    },
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Slate dark mode. Easy on the eyes.',
    dark: true,
    preview: { bg: '#0f172a', surface: '#1e293b', accent: '#3b82f6', text: '#f1f5f9', border: '#334155' },
    customTheme: {
      colors: {
        accent: '#3b82f6', accentDim: '#1e3a5f',
        bg: '#0f172a', surface: '#1e293b', surface2: '#273549',
        border: '#334155', borderDark: '#475569',
        text: '#f1f5f9', textMuted: '#94a3b8',
      },
      typography: { fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
      borders: { radius: 10, radiusSm: 6 },
    },
  },
  {
    id: 'aviation',
    label: 'Aviation',
    description: 'Instrument-panel aesthetic. Dark navy with cyan readouts. Monospace font. Sharp corners.',
    dark: true,
    preview: { bg: '#080c16', surface: '#0d1525', accent: '#00d4ff', text: '#c8e8f0', border: '#1a3a4a' },
    customTheme: {
      colors: {
        accent: '#00d4ff', accentDim: '#001a22',
        bg: '#080c16', surface: '#0d1525', surface2: '#132030',
        border: '#1a3a4a', borderDark: '#1f4d63',
        text: '#c8e8f0', textMuted: '#4a7a8a',
      },
      typography: { fontFamily: "'JetBrains Mono', 'Roboto Mono', 'Courier New', monospace" },
      borders: { radius: 4, radiusSm: 2 },
    },
  },
  {
    id: 'soft',
    label: 'Soft',
    description: 'Warm cream background, violet accent, very rounded corners. Approachable and friendly.',
    dark: false,
    preview: { bg: '#fffbf7', surface: '#fdf6ee', accent: '#7c3aed', text: '#2d1f0e', border: '#e8d5c0' },
    customTheme: {
      colors: {
        accent: '#7c3aed', accentDim: '#f5f3ff',
        bg: '#fffbf7', surface: '#fdf6ee', surface2: '#f5ece0',
        border: '#e8d5c0', borderDark: '#d4b896',
        text: '#2d1f0e', textMuted: '#8b6a4a',
      },
      typography: { fontFamily: "'Nunito', 'Segoe UI', system-ui, sans-serif" },
      borders: { radius: 16, radiusSm: 10 },
    },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Pure white, near-invisible borders, indigo accent. Typography-first.',
    dark: false,
    preview: { bg: '#ffffff', surface: '#ffffff', accent: '#6366f1', text: '#111827', border: '#f0f0f0' },
    customTheme: {
      colors: {
        accent: '#6366f1', accentDim: '#eef2ff',
        bg: '#ffffff', surface: '#ffffff', surface2: '#f9fafb',
        border: '#f0f0f0', borderDark: '#e5e5e5',
        text: '#111827', textMuted: '#6b7280',
      },
      typography: { fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
      borders: { radius: 8, radiusSm: 4 },
    },
  },
  {
    id: 'corporate',
    label: 'Corporate',
    description: 'Professional navy blue. Appropriate for enterprise dashboards.',
    dark: false,
    preview: { bg: '#ffffff', surface: '#f0f4f8', accent: '#1d4ed8', text: '#0f2040', border: '#c9d4e0' },
    customTheme: {
      colors: {
        accent: '#1d4ed8', accentDim: '#eff6ff',
        bg: '#ffffff', surface: '#f0f4f8', surface2: '#e2eaf2',
        border: '#c9d4e0', borderDark: '#9fb3c8',
        text: '#0f2040', textMuted: '#4a6080',
      },
      typography: { fontFamily: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif" },
      borders: { radius: 6, radiusSm: 3 },
    },
  },
  {
    id: 'forest',
    label: 'Forest',
    description: 'Earthy greens and warm browns. Natural, calm feel.',
    dark: false,
    preview: { bg: '#fafdf7', surface: '#f2f8ee', accent: '#15803d', text: '#1a2e12', border: '#c6ddb8' },
    customTheme: {
      colors: {
        accent: '#15803d', accentDim: '#f0fdf4',
        bg: '#fafdf7', surface: '#f2f8ee', surface2: '#e8f2e0',
        border: '#c6ddb8', borderDark: '#a8c893',
        text: '#1a2e12', textMuted: '#4a7030',
      },
      typography: { fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
      borders: { radius: 10, radiusSm: 6 },
    },
  },
  {
    id: 'ocean',
    label: 'Ocean',
    description: 'Deep ocean blue with sky-blue accents. Dark ambient feel.',
    dark: true,
    preview: { bg: '#0a1628', surface: '#0f1f38', accent: '#0ea5e9', text: '#e0f2fe', border: '#1e3a5a' },
    customTheme: {
      colors: {
        accent: '#0ea5e9', accentDim: '#082032',
        bg: '#0a1628', surface: '#0f1f38', surface2: '#162840',
        border: '#1e3a5a', borderDark: '#254d78',
        text: '#e0f2fe', textMuted: '#5b8db8',
      },
      typography: { fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
      borders: { radius: 8, radiusSm: 5 },
    },
  },
];

/** Convenience map: id → theme object */
export const THEMES_BY_ID = Object.fromEntries(THEMES.map(t => [t.id, t]));

/** IDs of all available themes */
export const THEME_IDS = THEMES.map(t => t.id);
