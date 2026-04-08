import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
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
