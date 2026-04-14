export const DEFAULT_CUSTOM_THEME = {
  colors: {
    accent: '#3b82f6',
    accentDim: '#eff6ff',
    bg: '#ffffff',
    surface: '#f8fafc',
    surface2: '#f1f5f9',
    border: '#e2e8f0',
    borderDark: '#cbd5e1',
    text: '#0f172a',
    textMuted: '#64748b',
  },
  typography: {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    headingFontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    monoFontFamily: "ui-monospace, 'Cascadia Code', 'SFMono-Regular', Menlo, monospace",
    baseSize: 14,
  },
  spacing: {
    density: 1,
  },
  borders: {
    radius: 10,
    radiusSm: 6,
    borderWidth: 1,
  },
  shadows: {
    elevation: 10,
  },
};

export function mergeTheme(base, patch) {
  const next = { ...base };
  for (const key of Object.keys(patch || {})) {
    const value = patch[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      next[key] = mergeTheme(base[key] ?? {}, value);
    } else if (value !== undefined) {
      next[key] = value;
    }
  }
  return next;
}

export function normalizeCustomTheme(theme) {
  return mergeTheme(DEFAULT_CUSTOM_THEME, theme || {});
}

export function customThemeToCssVars(themeInput) {
  if (!themeInput || (typeof themeInput === 'object' && Object.keys(themeInput).length === 0)) return undefined;
  const theme = normalizeCustomTheme(themeInput);
  const def   = DEFAULT_CUSTOM_THEME;
  const vars  = {};

  // Only emit a CSS custom property when the value explicitly differs from the
  // built-in default.  This prevents a stored customTheme from overriding named
  // CSS themes (aviation, dark, ocean …) via inline-style specificity when the
  // user hasn't actually changed that particular token.
  const c = theme.colors;
  const dc = def.colors;
  if (c.accent     !== dc.accent)     vars['--wc-accent']      = c.accent;
  if (c.accentDim  !== dc.accentDim)  vars['--wc-accent-dim']  = c.accentDim;
  if (c.bg         !== dc.bg)         vars['--wc-bg']          = c.bg;
  if (c.surface    !== dc.surface)    vars['--wc-surface']     = c.surface;
  if (c.surface2   !== dc.surface2)   vars['--wc-surface-2']   = c.surface2;
  if (c.border     !== dc.border)     vars['--wc-border']      = c.border;
  if (c.borderDark !== dc.borderDark) vars['--wc-border-dark'] = c.borderDark;
  if (c.text       !== dc.text)       vars['--wc-text']        = c.text;
  if (c.textMuted  !== dc.textMuted)  vars['--wc-text-muted']  = c.textMuted;

  const t = theme.typography;
  const dt = def.typography;
  if (t.fontFamily        !== dt.fontFamily)        vars['--wc-font']            = t.fontFamily;
  if (t.headingFontFamily !== dt.headingFontFamily) vars['--wc-font-heading']    = t.headingFontFamily || t.fontFamily;
  if (t.monoFontFamily    !== dt.monoFontFamily)    vars['--wc-font-mono']       = t.monoFontFamily;
  if (t.baseSize          !== dt.baseSize)          vars['--wc-base-font-size']  = `${t.baseSize}px`;

  const density = Math.max(0.8, Math.min(1.2, Number(theme.spacing.density) || 1));
  if (theme.spacing.density !== def.spacing.density) vars['--wc-density'] = density;

  const b = theme.borders;
  const db = def.borders;
  if (b.radius      !== db.radius)      vars['--wc-radius']       = `${b.radius}px`;
  if (b.radiusSm    !== db.radiusSm)    vars['--wc-radius-sm']    = `${b.radiusSm}px`;
  if (b.borderWidth !== db.borderWidth) vars['--wc-border-width'] = `${b.borderWidth}px`;

  const e  = Math.max(0, Number(theme.shadows.elevation) || 0);
  const de = Math.max(0, Number(def.shadows.elevation)   || 0);
  if (e !== de) {
    vars['--wc-shadow']    = `0 4px ${12 + Math.round(e)}px rgba(0,0,0,${(0.08 + e / 200).toFixed(2)})`;
    vars['--wc-shadow-sm'] = `0 1px ${3  + Math.round(e / 3)}px rgba(0,0,0,${(0.05 + e / 250).toFixed(2)})`;
  }

  return Object.keys(vars).length > 0 ? vars : undefined;
}
