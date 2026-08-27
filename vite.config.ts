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
    // without a DOM; only the component tests need one, and they opt in with a
    // `@vitest-environment happy-dom` docblock.
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // The default 5s is meant for unit tests, and these are not all unit tests.
    // Walking a whole session into the report renders seventeen plates, a few
    // hundred staircase trials and six scenes simulated pixel by pixel: 1.5s on
    // a laptop, and 5.2s on a two-core CI runner sharing itself with the other
    // suites, which is how this first showed up as a CI-only failure.
    //
    // Raised well past what any current test needs rather than trimmed to fit,
    // because a runner under load has no ceiling worth guessing at. Nothing
    // depends on the timeout to catch a stuck state machine -- every stage loop
    // in the session test is bounded by its own iteration guard and fails with a
    // useful message instead.
    testTimeout: 30_000,
  },
});
