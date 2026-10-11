import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'sandbox',
    root: import.meta.dirname,
    include: ['src/**/*.sandbox.test.ts'],
    environment: 'node',
    // Each hostile case can legitimately run up to the wall-clock limit, and the suite asserts
    // that no containers are left behind, so run files and tests one at a time.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
