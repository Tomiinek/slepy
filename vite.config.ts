import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  // Relative base so the built site works when opened from a file path or served
  // from a subdirectory; there is no backend to route around.
  base: './',
  server: {
    // Native filesystem events do not reach the dev server on every setup, and
    // the failure mode is silent: the page keeps serving the last version it saw
    // and edits appear to do nothing. Polling is a little more work for the CPU
    // and much less confusing.
    watch: { usePolling: true, interval: 300 },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname ?? '.', 'src'),
    },
  },
  test: {
    // The colour and engine suites are pure computation and run much faster
    // without a DOM; only the component tests need jsdom, and they opt in with
    // a `@vitest-environment jsdom` docblock.
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
