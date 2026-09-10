import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  // Vite 8 switched to Rolldown, which aligns CJS interop to esbuild's semantics: a default
  // import of a CJS module now yields the module namespace object rather than its
  // `exports.default`. This library default-imports CJS modules that ship no `exports` map
  // (`@mui/icons-material/<Icon>` chief among them), so every such icon would render as an
  // object and throw React error #130. Restore the pre-Vite-8 behavior until those imports
  // are migrated.
  legacy: {
    inconsistentCjsInterop: true,
  },
  plugins: [react(), svgr()],
  resolve: {
    preserveSymlinks: true,
    tsconfigPaths: true,
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'lib/main.ts'),
      formats: ['es'],
    },
  },
});
