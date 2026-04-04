import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 120_000, // 2 minutes — LLM calls can be slow
    hookTimeout: 30_000,
    setupFiles: ['./src/setup.ts'],
  },
});
