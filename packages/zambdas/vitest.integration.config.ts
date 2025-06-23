import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: true,
    silent: true,
    testTimeout: 60000,
    include: ['*/integration/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    provide: {
      EXECUTE_ZAMBDA_URL: 'http://localhost:3000/local',
    },
  },
});
