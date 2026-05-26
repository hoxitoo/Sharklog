import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_'],
  resolve: {
    alias: {
      '@sharklog/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
  // Prevent Vite's pre-bundler and Rollup's commonjs plugin from trying to
  // resolve @sharklog/core via package.json (dist/ may not exist in CI).
  // The alias above handles all imports directly from TypeScript source.
  optimizeDeps: {
    exclude: ['@sharklog/core'],
  },
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    commonjsOptions: {
      exclude: [/@sharklog\/core/],
    },
  },
});
