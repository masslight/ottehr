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
      // Vite 8 switched to Rolldown, which aligns CJS interop to esbuild's semantics: a default
      // import of a CJS module now yields the module namespace object rather than its
      // `exports.default`. This app default-imports CJS modules that ship no `exports` map
      // (`@mui/icons-material/<Icon>` chief among them), so every such icon would render as an
      // object and throw React error #130. Restore the pre-Vite-8 behavior until those imports
      // are migrated.
      legacy: {
        inconsistentCjsInterop: true,
      },
      build: {
        // Only emit sourcemaps when they'll actually be uploaded to Sentry.
        // Generating them for every env (e2e*, local) bloats rollup's
        // "rendering chunks" phase and OOMs the build.
        sourcemap: shouldUploadSentrySourceMaps,
      },
      plugins,
      server: {
        open: !process.env.VITE_NO_OPEN,
        host: '0.0.0.0',
        watch: {
          ignored: ['**/.env.local'],
        },
        https:
          tlsCertExists && tlsKeyExists
            ? {
                cert: './env/cert.pem',
                key: './env/key.pem',
              }
            : undefined,
      },
      resolve: {
        preserveSymlinks: true,
        alias: [
          // Resolve the workspace packages to their real source directories. `preserveSymlinks`
          // otherwise resolves them inside node_modules, where vite treats them as prebundlable
          // deps: it serves their source raw and, with it, their transitive deps — fatal for CJS
          // ones like `prop-types` (reached via react-imask) that have no named exports to give.
          { find: /^utils(\/|$)/, replacement: path.resolve(__dirname, '../../packages/utils') + '/' },
          {
            find: /^ui-components(\/|$)/,
            replacement: path.resolve(__dirname, '../../packages/ui-components') + '/',
          },
          { find: '@theme', replacement: path.resolve(__dirname, appEnv.THEME_PATH || '/src/themes/ottehr') },
          { find: '@defaultTheme', replacement: path.resolve(__dirname, '/src/themes/ottehr') },
        ],
      },
    })
  );
};
