import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node24',
  platform: 'node',
  clean: true,
  // The shared package ships TypeScript source, so bundle it into the output.
  noExternal: ['@theshire/shared'],
});
