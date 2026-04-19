import { resolve, extname } from 'path';
import { existsSync } from 'fs';
import type { Plugin } from 'vite';

/**
 * Resolve `.js` imports to sibling `.ts`/`.tsx` files during the JS→TS
 * migration. Delete this plugin (and its callers) once all source files are
 * TypeScript and all internal import specifiers have been updated.
 */
export function tsExtensionFallback(): Plugin {
  return {
    name: 'ts-extension-fallback',
    resolveId(source, importer) {
      if (!importer) return null;
      if (extname(source) !== '.js') return null;
      const candidates = [
        source.replace(/\.js$/, '.ts'),
        source.replace(/\.js$/, '.tsx'),
      ];
      for (const cand of candidates) {
        const full = resolve(importer, '..', cand);
        if (existsSync(full)) return full;
      }
      return null;
    },
  };
}
