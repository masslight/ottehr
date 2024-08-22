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
          '@assets': path.resolve(__dirname, appEnv.ASSETS_PATH || '/src/assets'),
          '@theme': path.resolve(__dirname, appEnv.THEME_PATH || '/src/assets/theme'),
          '@defaultTheme': path.resolve(__dirname, '/src/assets/theme'),
          '@translations': path.resolve(__dirname, appEnv.TRANSLATIONS_PATH || '/src/lib'),
          '@defaultTranslations': path.resolve(__dirname, '/src/lib'),
        },
      },
      optimizeDeps: {
        include: ['@mui/icons-material', '@mui/material', '@emotion/react', '@emotion/styled'],
      },
      build: {
        sourcemap: mode === 'default' || shouldUploadSentrySourceMaps,
      },
      server: {
        open: 'location/ak/in-person/prebook',
      },
      plugins,
    })
  );
};
