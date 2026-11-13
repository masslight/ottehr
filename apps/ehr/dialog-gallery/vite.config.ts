// Dev-only harness that mounts every EHR modal dialog in isolation so they can be screenshotted
// side by side. Run from apps/ehr:  npx vite --config dialog-gallery/vite.config.ts
import react from '@vitejs/plugin-react';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';
import svgr from 'vite-plugin-svgr';

const here = path.dirname(fileURLToPath(import.meta.url));
const ehrRoot = path.resolve(here, '..');
const coreRoot = path.resolve(ehrRoot, '../..');

const mockEnv: Record<string, string> = {
  VITE_APP_ENV: 'local',
  VITE_APP_IS_LOCAL: 'true',
  VITE_APP_NAME: 'Dialog gallery',
  VITE_APP_FHIR_API_URL: 'https://mock.invalid/fhir',
  VITE_APP_PROJECT_API_URL: 'https://mock.invalid/project',
  VITE_APP_PROJECT_API_ZAMBDA_URL: 'https://mock.invalid/zambda',
  VITE_APP_PROJECT_ID: 'mock-project',
  VITE_APP_ORGANIZATION_NAME_LONG: 'Ottehr',
  VITE_APP_ORGANIZATION_NAME_SHORT: 'Ottehr',
};
for (const [k, v] of Object.entries(mockEnv)) process.env[k] ??= v;

const adHocReportRuntimeStub = (): Plugin => {
  const VIRTUAL_ID = 'virtual:adhoc-report-runtime';
  const RESOLVED_ID = `\0${VIRTUAL_ID}`;
  return {
    name: 'adhoc-report-runtime-stub',
    resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : undefined),
    load: (id) => (id === RESOLVED_ID ? 'export default "";' : undefined),
  };
};

export default defineConfig({
  root: ehrRoot,
  envDir: path.join(here, 'no-env'),
  publicDir: 'public',
  legacy: { inconsistentCjsInterop: true },
  plugins: [react(), svgr(), adHocReportRuntimeStub()],
  server: { port: 4555, strictPort: true, host: '127.0.0.1', open: false, hmr: false },
  define: { global: 'globalThis' },
  resolve: {
    preserveSymlinks: true,
    tsconfigPaths: true,
    alias: [
      { find: /^utils(\/|$)/, replacement: path.resolve(coreRoot, 'packages/utils') + '/' },
      { find: /^ui-components(\/|$)/, replacement: path.resolve(coreRoot, 'packages/ui-components') + '/' },
      { find: /^config-types(\/|$)/, replacement: path.resolve(coreRoot, 'packages/config-types') + '/' },
      { find: '@ehrTheme', replacement: path.resolve(ehrRoot, 'src/themes/ottehr') },
      { find: '@ehrDefaultTheme', replacement: path.resolve(ehrRoot, 'src/themes/ottehr') },
      // Every dialog sees a signed-in user without a real Auth0 tenant.
      { find: /^@auth0\/auth0-react$/, replacement: path.resolve(here, 'harness/auth0-mock.tsx') },
    ],
  },
});
