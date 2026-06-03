import { defineConfig } from 'vite';

// Base path kept relative so the static build works on any host (incl. GitHub Pages subpaths).
export default defineConfig({
  base: './',
  server: {
    host: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
