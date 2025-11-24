import dotenv from 'dotenv';
import path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

dotenv.config({ path: path.resolve(__dirname, 'env/.env.local') });

export default defineConfig({
  test: {
    globals: !process.env.PLAYWRIGHT_TEST_BASE_URL, // Disable globals when Playwright is running
    exclude: ['**/*.spec.ts', '**/*.test.tsx'],
  },
  plugins: [tsconfigPaths()],
});
