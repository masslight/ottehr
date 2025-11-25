import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

dotenv.config({ path: path.resolve(__dirname, 'env/.env.local') });

export default defineConfig({
  test: {
    globals: true,
    include: ['**/*.test.tsx'],
    setupFiles: './tests/component/setup.ts',
    environment: 'happy-dom',
  },
  plugins: [tsconfigPaths(), react()],
});
