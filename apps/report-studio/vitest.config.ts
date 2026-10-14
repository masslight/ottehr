import * as path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));
const coreRoot = path.resolve(here, '../..');

// Unit tests of the pure parts (runtime helpers, trim, plan comparison, code check). Same package
// aliases as vite.config.ts so the deep `utils/lib/...` imports resolve.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'runtime/**/*.test.ts'],
    setupFiles: ['../../packages/test-utils/lib/no-network.setup.ts'],
  },
  resolve: {
    preserveSymlinks: true,
    alias: [
      { find: /^utils(\/|$)/, replacement: path.resolve(coreRoot, 'packages/utils') + '/' },
      { find: /^ui-components(\/|$)/, replacement: path.resolve(coreRoot, 'packages/ui-components') + '/' },
      { find: /^config-types(\/|$)/, replacement: path.resolve(coreRoot, 'packages/config-types') + '/' },
    ],
  },
});
