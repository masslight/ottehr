import { mergeConfig } from 'vite';
import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      setupFiles: ['../test-utils/lib/no-network.setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['lcov', 'text-summary', 'json'],
        reportsDirectory: './coverage',
        include: ['lib/**/*.{ts,tsx}'],
        exclude: ['lib/**/*.test.{ts,tsx}', 'lib/**/*.spec.{ts,tsx}', 'lib/**/*.d.ts'],
      },
    },
  })
);
