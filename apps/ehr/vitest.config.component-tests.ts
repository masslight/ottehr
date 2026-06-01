import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

const envName = process.env.ENV || 'local';
dotenv.config({ path: path.resolve(__dirname, `env/.env.${envName}`) });

export default defineConfig({
  test: {
    // Disable globals to avoid conflicts with Playwright's expect during test execution
    globals: false,
    include: ['**/*.test.tsx'],
    setupFiles: ['../../packages/test-utils/lib/no-network.setup.ts', './tests/component/setup.ts'],
    environment: 'jsdom',
    testTimeout: 30_000, // 30 seconds
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
  plugins: [tsconfigPaths(), react()],
});
