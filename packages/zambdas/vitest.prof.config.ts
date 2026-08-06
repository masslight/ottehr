import { configDefaults, defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    silent: true,
    name: 'unit',
    include: ['probe-tmp/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'test/integration/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ['../test-utils/lib/no-network.setup.ts', './vitest.setup.ts'],
    server: { deps: { inline: [/@sentry/, /utils/] } },
    maxWorkers: 1,
    minWorkers: 1,
    poolOptions: {
      forks: {
        singleFork: true,
        execArgv: ['--max-old-space-size=1024'],
      },
    },
  },
});
