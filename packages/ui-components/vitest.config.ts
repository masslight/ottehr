import { mergeConfig } from 'vite';
import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
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
