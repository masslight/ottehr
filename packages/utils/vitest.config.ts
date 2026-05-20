import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    silent: true,
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text-summary', 'json'],
      reportsDirectory: './coverage',
      include: ['lib/**/*.{ts,tsx}'],
      exclude: ['lib/**/*.test.{ts,tsx}', 'lib/**/*.spec.{ts,tsx}', 'lib/**/*.d.ts'],
    },
  },
});
