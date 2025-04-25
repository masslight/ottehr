import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';

dotenv.config({ path: path.resolve(__dirname, 'env/.env.local') });

export default defineConfig({
  test: {
    globals: true,
    exclude: ['**/*.spec.ts'],
    environment: 'jsdom',
  },
  plugins: [tsconfigPaths()],
});
