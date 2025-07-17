import dotenv from 'dotenv';
import path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

dotenv.config({ path: path.resolve(__dirname, 'env/.env.local') });

export default defineConfig({
  test: {
    globals: true,
    exclude: ['**/*.spec.ts', '**/*.test.tsx'],
  },
  plugins: [tsconfigPaths()],
});
