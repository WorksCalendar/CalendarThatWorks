import { normalizeCustomTheme, customThemeToCssVars } from '../core/themeSchema.js';
import styles from './ThemeCustomizer.module.css';

const COLOR_CONTROLS = [
  ['accent', 'Accent'],
  ['accentDim', 'Accent Soft'],
  ['bg', 'Background'],
  ['surface', 'Surface'],
  ['surface2', 'Surface 2'],
  ['border', 'Border'],
  ['borderDark', 'Strong Border'],
  ['text', 'Text'],
  ['textMuted', 'Muted Text'],
];

export default function ThemeCustomizer({ theme, onChange }) {
  const merged = normalizeCustomTheme(theme);
  const previewVars = customThemeToCssVars(merged);

  function update(path, value) {
    onChange((config) => {
      const current = normalizeCustomTheme(config.customTheme);
      const [group, key] = path;
      return {
        ...config,
        customTheme: {
          ...current,
          [group]: {
            ...current[group],
            [key]: value,
          },
        },
      };
    });
  }

  return (
    <div className={styles.section}>
      <p>Tune colors and core style tokens. Changes are saved to <code>ownerConfig.customTheme</code>.</p>

      <div className={styles.grid}>
        {COLOR_CONTROLS.map(([key, label]) => (
          <label key={key} className={styles.control}>
            <span>{label}</span>
            <input type="color" value={merged.colors[key]} onChange={(e) => update(['colors', key], e.target.value)} />
          </label>
        ))}

        <label className={styles.control}>
          <span>Font Family</span>
          <input
            type="text"
            value={merged.typography.fontFamily}
            onChange={(e) => update(['typography', 'fontFamily'], e.target.value)}
          />
        </label>

        <label className={styles.control}>
          <span>Base Font Size ({merged.typography.baseSize}px)</span>
          <input
            type="range"
            min={12}
            max={20}
            step={1}
            value={merged.typography.baseSize}
            onChange={(e) => update(['typography', 'baseSize'], Number(e.target.value))}
          />
        </label>

        <label className={styles.control}>
          <span>Radius ({merged.borders.radius}px)</span>
          <input
            type="range"
            min={0}
            max={24}
            step={1}
            value={merged.borders.radius}
            onChange={(e) => update(['borders', 'radius'], Number(e.target.value))}
          />
        </label>

        <label className={styles.control}>
          <span>Shadow ({merged.shadows.elevation})</span>
          <input
            type="range"
            min={0}
            max={32}
            step={1}
            value={merged.shadows.elevation}
            onChange={(e) => update(['shadows', 'elevation'], Number(e.target.value))}
          />
        </label>
      </div>

      <div className={styles.preview} style={previewVars}>
        <div className={styles.previewHeader}>
          <strong>Live Preview</strong>
          <span className={styles.badge}>Mini Calendar</span>
        </div>
        <div className={styles.previewBody}>
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className={styles.day}>
              {(i === 2 || i === 8) && <div className={styles.event} />}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.btn} onClick={() => onChange((c) => ({ ...c, customTheme: {} }))}>Reset to default</button>
      </div>
    </div>
  );
}
