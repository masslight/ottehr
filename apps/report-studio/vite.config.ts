import react from '@vitejs/plugin-react';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { reportStudioRuntime } from './runtime-plugin';

const here = path.dirname(fileURLToPath(import.meta.url));
const coreRoot = path.resolve(here, '../..');

// Builds the whole studio (the sandboxed report runtime included, as an inlined string) into one
// self-contained HTML file that runs from a double-click, with no server. Mirrors Form Studio.
export default defineConfig({
  base: './',
  legacy: {
    // same reason as the EHR: default imports of CJS modules without an exports map (@mui/icons-material/<Icon>)
    inconsistentCjsInterop: true,
  },
  plugins: [react(), reportStudioRuntime(), viteSingleFile({ removeViteModuleLoader: true })],
  define: {
    global: 'globalThis',
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    preserveSymlinks: true,
    alias: [
      { find: /^utils(\/|$)/, replacement: path.resolve(coreRoot, 'packages/utils') + '/' },
      { find: /^ui-components(\/|$)/, replacement: path.resolve(coreRoot, 'packages/ui-components') + '/' },
      { find: /^config-types(\/|$)/, replacement: path.resolve(coreRoot, 'packages/config-types') + '/' },
      { find: /^ehr-src(\/|$)/, replacement: path.resolve(coreRoot, 'apps/ehr/src') + '/' },
    ],
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    chunkSizeWarningLimit: 20000,
    assetsInlineLimit: 100_000_000,
  },
  server: { port: 4124 },
});
