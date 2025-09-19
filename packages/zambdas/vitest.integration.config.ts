import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    silent: true,
    testTimeout: 180000, // 3 minutes
    hookTimeout: 30000, // 30 seconds
    include: ['*/integration/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    provide: {
      EXECUTE_ZAMBDA_URL: 'http://localhost:3000/local',
    },
  },
});
