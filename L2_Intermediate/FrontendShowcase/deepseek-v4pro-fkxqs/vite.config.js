import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5183,
    strictPort: false,
    open: false,
    // Dependencies may be hoisted to the monorepo root (npm workspaces),
    // which lives above this project root — allow serving from there.
    fs: { strict: false },
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  },
});
