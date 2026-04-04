import { mergeConfig } from 'vite';
import { defineConfig } from 'vitest/config';
import GithubActionsReporter from 'vitest-github-actions-reporter';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      coverage: {
        reporter: ['text', 'json', 'html'],
      },
      reporters: process.env.CI ? ['default', new GithubActionsReporter()] : ['default'],
    },
  })
);
