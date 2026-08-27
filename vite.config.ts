import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  // Relative base so the built site works when opened from a file path or served
  // from a subdirectory; there is no backend to route around.
  base: './',
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
