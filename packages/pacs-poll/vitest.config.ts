import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    silent: true,
    include: ['test/**/*.test.ts'],
    setupFiles: ['../test-utils/lib/no-network.setup.ts'],
  },
});
