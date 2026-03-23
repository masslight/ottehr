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
    exclude: ['**/*.spec.ts', '**/*.test.tsx'],
  },
  plugins: [tsconfigPaths()],
});
