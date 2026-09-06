import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import path from 'path';
import { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const envName = process.env.ENV || 'local';
dotenv.config({ path: path.resolve(__dirname, `env/.env.${envName}`) });

// The real virtual module (adhoc-report-runtime-plugin) runs a full esbuild bundle of the iframe
// runtime — pointless and slow under jsdom, where the sandbox iframe never mounts. Component tests
// only need the import to resolve, so stub it with an empty bundle string.
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
  test: {
    // Disable globals to avoid conflicts with Playwright's expect during test execution
    globals: false,
    include: ['**/*.test.tsx'],
    setupFiles: ['../../packages/test-utils/lib/no-network.setup.ts', './tests/component/setup.ts'],
    environment: 'jsdom',
    testTimeout: 30_000, // 30 seconds
    retry: 1,
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text-summary', 'json'],
      reportsDirectory: './coverage/component',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/*.d.ts',
        'src/**/types/**',
        'src/**/__mocks__/**',
      ],
    },
  },
  plugins: [react(), adHocReportRuntimeStub()],
  resolve: {
    tsconfigPaths: true,
  },
});
