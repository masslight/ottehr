import { sentryVitePlugin } from '@sentry/vite-plugin';
import * as path from 'path';
import { PluginOption, defineConfig, loadEnv, mergeConfig } from 'vite';
import config from '../../../vite.config';

export default (env) => {
  const { mode } = env;
  const envDir = './env';
  const appEnv = loadEnv(mode, path.join(process.cwd(), envDir), '');

  const shouldUploadSentrySourceMaps =
    mode === 'testing' || mode === 'staging' || mode === 'dev' || mode === 'production' || mode === 'training';
  console.log(mode);

  const plugins: PluginOption[] = [
    // IstanbulPlugin({
    //   include: 'src/*',
    //   extension: ['.js', '.ts', '.tsx'],
    // }),
  ];

  if (shouldUploadSentrySourceMaps)
    plugins.push(
      sentryVitePlugin({
        authToken: appEnv.SENTRY_AUTH_TOKEN,
        org: 'zapehr',
        project: 'ottehr-telemed-qrs-ui',
        sourcemaps: {
          assets: ['./build/**/*'],
        },
      })
    );

  return mergeConfig(
    config({ mode }),
    defineConfig({
      //   optimizeDeps: {
      //     include: ['playwright'],
      //   },
      resolve: {
        alias: {
          '@theme': path.resolve(__dirname, appEnv.THEME_PATH || '/src/theme/ottehr'),
          '@defaultTheme': path.resolve(__dirname, '/src/theme/ottehr'),
        },
      },
      optimizeDeps: {
        include: ['@mui/icons-material', '@mui/material', '@emotion/react', '@emotion/styled'],
      },
      build: {
        sourcemap: mode === 'default' || shouldUploadSentrySourceMaps,
      },
      server: {
        open: appEnv.DEFAULT_PATH ?? 'location/ak/in-person/prebook',
      },
      plugins,
    })
  );
};
