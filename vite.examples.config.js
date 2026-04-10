import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, extname } from 'path';
import { existsSync } from 'fs';

/**
 * Resolve `.js` imports to `.ts` files in the dev server.
 * The engine source uses `.js` extension for all TS imports (ESM convention).
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

export default defineConfig({
  plugins: [react(), tsExtensionFallback()],
  root: 'examples',
  build: {
    outDir: '../dist-examples',
    emptyOutDir: true,
  },
  server: {
    port: 3001,
    open: true,
  },
});
