import { sentryVitePlugin } from '@sentry/vite-plugin';
import { existsSync } from 'fs';
import path from 'path';
import { defineConfig, loadEnv, mergeConfig, PluginOption } from 'vite';
import IstanbulPlugin from 'vite-plugin-istanbul';
import config from '../../vite.config';

export default (env: any): Record<string, any> => {
  const { mode } = env;
  const envDir = './env';
  const appEnv = loadEnv(mode, path.join(process.cwd(), envDir), '');

  const shouldUploadSentrySourceMaps =
    Boolean(appEnv.SENTRY_AUTH_TOKEN) && Boolean(appEnv.SENTRY_ORG) && Boolean(appEnv.SENTRY_PROJECT);

  console.log(shouldUploadSentrySourceMaps ? 'Configuring SentryVitePlugin' : 'skipping SentryVitePlugin');
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

  const tlsCertExists = existsSync(path.join(process.cwd(), envDir, 'cert.pem'));
  const tlsKeyExists = existsSync(path.join(process.cwd(), envDir, 'key.pem'));
  if (tlsCertExists && tlsKeyExists) {
    console.log(`Found TLS certificate and key, serving in ${mode} over HTTPS`);
  } else if (tlsCertExists && !tlsKeyExists) {
    console.error(`Found TLS certificate but private key is missing, serving in ${mode} over HTTP`);
  } else if (!tlsCertExists && tlsKeyExists) {
    console.error(`Found TLS private key but certificate is missing, serving in ${mode} over HTTP`);
  }

  return mergeConfig(
    config({ mode }),
    defineConfig({
      build: {
        sourcemap: true,
      },
      plugins,
      server: {
        open: !process.env.VITE_NO_OPEN,
        host: '0.0.0.0',
        https:
          tlsCertExists && tlsKeyExists
            ? {
                cert: './env/cert.pem',
                key: './env/key.pem',
              }
            : undefined,
      },
      resolve: {
        alias: {
          '@theme': path.resolve(__dirname, appEnv.THEME_PATH || '/src/themes/ottehr'),
          '@defaultTheme': path.resolve(__dirname, '/src/themes/ottehr'),
        },
      },
    })
  );
};
