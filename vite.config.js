import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, extname } from 'path';
import { readdirSync, mkdirSync, copyFileSync, existsSync } from 'fs';

/**
 * Rollup plugin: resolve `.js` imports to `.ts` files when the `.js` doesn't
 * exist but the `.ts` counterpart does.  Required for the library build because
 * the engine's TypeScript files use the standard `.js` extension convention.
 */
function tsExtensionFallback() {
  return {
    name: 'ts-extension-fallback',
    resolveId(source, importer) {
      if (!importer) return null;
      if (extname(source) !== '.js') return null;
      const tsPath = source.replace(/\.js$/, '.ts');
      const base = resolve(importer, '..', tsPath);
      if (existsSync(base)) return base;
      return null;
    },
  };
}

/** Copy src/styles/*.css → dist/themes/ after lib build */
const copyThemesPlugin = () => ({
  name: 'copy-themes',
  closeBundle() {
    mkdirSync('dist/themes', { recursive: true });
    readdirSync('src/styles')
      .filter(f => f.endsWith('.css'))
      .forEach(f => copyFileSync(`src/styles/${f}`, `dist/themes/${f}`));
  },
});

export default defineConfig({
  plugins: [react(), tsExtensionFallback(), copyThemesPlugin()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'WorksCalendar',
      formats: ['es', 'umd'],
      fileName: (format) => `works-calendar.${format}.js`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'xlsx', '@supabase/supabase-js'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
});
