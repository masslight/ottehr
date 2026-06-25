import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    silent: true,
    setupFiles: ['../test-utils/lib/no-network.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text-summary', 'json'],
      reportsDirectory: './coverage',
      include: ['lib/**/*.{ts,tsx}'],
      exclude: ['lib/**/*.test.{ts,tsx}', 'lib/**/*.spec.{ts,tsx}', 'lib/**/*.d.ts'],
    },
  },
});
