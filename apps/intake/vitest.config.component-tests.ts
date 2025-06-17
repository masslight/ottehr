import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';

dotenv.config({ path: path.resolve(__dirname, 'env/.env.local') });

export default defineConfig({
  test: {
    globals: true,
    include: ['**/*.test.tsx'],
    setupFiles: './tests/component/setup.ts',
    environment: 'jsdom',
  },
  plugins: [tsconfigPaths(), react()],
});
