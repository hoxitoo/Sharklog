import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/store/**', 'src/utils/**', 'src/storage/**'],
    },
  },
  resolve: {
    alias: { '@sharklog/core': new URL('../../packages/core/src/index.ts', import.meta.url).pathname },
  },
});
