import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';
import GithubActionsReporter from 'vitest-github-actions-reporter';

const envName = process.env.ENV || 'local';
dotenv.config({ path: path.resolve(__dirname, `env/.env.${envName}`) });

export default defineConfig({
  test: {
    // Disable globals to avoid conflicts with Playwright's expect during test execution
    globals: false,
    include: ['**/*.test.tsx'],
    setupFiles: ['./tests/component/setup.ts'],
    environment: 'jsdom',
    testTimeout: 30_000, // 30 seconds
    reporters: process.env.CI ? ['default', new GithubActionsReporter()] : ['default'],
  },
  plugins: [tsconfigPaths(), react()],
});
