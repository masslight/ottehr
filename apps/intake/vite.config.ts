import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
import { PluginOption, defineConfig, loadEnv, mergeConfig } from 'vite';
import IstanbulPlugin from 'vite-plugin-istanbul';
import config from '../../vite.config';

export default (env) => {
  const { mode } = env;
  const envDir = './env';
  const appEnv = loadEnv(mode, path.join(process.cwd(), envDir), '');

  const shouldUploadSentrySourceMaps =
    Boolean(appEnv.SENTRY_AUTH_TOKEN) && Boolean(appEnv.SENTRY_ORG) && Boolean(appEnv.SENTRY_PROJECT);

  console.log('vite mode:', mode);

  const plugins: PluginOption[] = [
    IstanbulPlugin({
      include: 'src/*',
      extension: ['.js', '.ts', '.tsx'],
    }),
  ];

  if (shouldUploadSentrySourceMaps) {
    plugins.push(
      sentryVitePlugin({
        authToken: appEnv.SENTRY_AUTH_TOKEN,
        org: appEnv.SENTRY_ORG,
        project: appEnv.SENTRY_PROJECT,
        sourcemaps: {
          assets: ['./build/**/*'],
        },
      })
    );
  }

  return mergeConfig(
    config({ mode }),
    defineConfig({
      build: {
        sourcemap: shouldUploadSentrySourceMaps,
      },
      plugins,
      server: {
        open: !process.env.VITE_NO_OPEN,
        host: '0.0.0.0',
      },
    })
  );
};
