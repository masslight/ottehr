import dotenv from 'dotenv';
import path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

dotenv.config({ path: path.resolve(__dirname, 'env/.env.local') });

export default defineConfig({
  test: {
    // Disable globals to avoid conflicts with Playwright's expect in CI
    globals: false,
    exclude: ['**/*.spec.ts', '**/*.test.tsx'],
    setupFiles: ['vitest/globals'],
  },
  plugins: [tsconfigPaths()],
});
