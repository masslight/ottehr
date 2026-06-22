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
    setupFiles: ['../../packages/test-utils/lib/no-network.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text-summary', 'json'],
      reportsDirectory: './coverage/unit',
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
  plugins: [tsconfigPaths()],
});
