import { defineConfig } from 'tsup';

// Bundles the workspace packages (which ship TypeScript source) and leaves npm dependencies external.
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  sourcemap: true,
  noExternal: [/^@vigas\//],
});
