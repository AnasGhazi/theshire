import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'api',
    environment: 'node',
    // Sandbox tests need Docker; they run separately via `npm run test:sandbox`.
    exclude: ['**/node_modules/**', '**/*.sandbox.test.ts'],
  },
});
