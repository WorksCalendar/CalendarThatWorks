import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tsExtensionFallback } from './scripts/vite-ts-fallback';

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
