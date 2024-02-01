import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
import { defineConfig, loadEnv, mergeConfig } from 'vite';
import config from '../../../vite.config';

export default (env) => {
  const { mode } = env;
  const envDir = './env';
  const appEnv = loadEnv(mode, path.join(process.cwd(), envDir), '');

  const shouldUploadSentrySourceMaps = mode === 'testing' || mode === 'staging' || mode === 'dev';
  console.log(mode);

  return mergeConfig(
    config({ mode }),
    defineConfig({
      build: {
        sourcemap: mode === 'default' || shouldUploadSentrySourceMaps,
      },
      optimizeDeps: {
        exclude: ['js-big-decimal'],
      },
      plugins: [
        shouldUploadSentrySourceMaps
          ? sentryVitePlugin({
              authToken: appEnv.SENTRY_AUTH_TOKEN,
              org: 'masslight-j2',
              project: 'urgent-care-qrs',
              sourcemaps: {
                assets: ['./build/**/*'],
              },
            })
          : null,
      ],
    }),
  );
};
