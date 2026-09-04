import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import { existsSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv, UserConfig } from 'vite';
import svgr from 'vite-plugin-svgr';
import { devStampRestartPlugin } from '../../vite/dev-stamp-restart';
import { adHocReportRuntime } from './adhoc-report-runtime-plugin';

const coreRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default ({ mode }: { mode: string }): UserConfig => {
  console.log(`Mode is: ${mode}`);

  const envDir = './env';
  const env = loadEnv(mode, path.join(process.cwd(), envDir), '');

  const plugins = [devStampRestartPlugin(coreRoot), react(), svgr(), adHocReportRuntime()];

  const shouldUploadSentrySourceMaps =
    Boolean(env.SENTRY_AUTH_TOKEN) && Boolean(env.SENTRY_ORG) && Boolean(env.SENTRY_PROJECT);
  console.log(shouldUploadSentrySourceMaps ? 'Configuring SentryVitePlugin' : 'skipping SentryVitePlugin');
  if (shouldUploadSentrySourceMaps) {
    plugins.push(
      sentryVitePlugin({
        authToken: env.SENTRY_AUTH_TOKEN,
        org: env.SENTRY_ORG,
        project: env.SENTRY_PROJECT,
        sourcemaps: {
          assets: ['./build/**/*'],
        },
        // Release injection is disabled because @sentry/vite-plugin 2.x predates Rolldown and its
        // injected module deadlocks against Vite 8's runtime chunk: the runtime imports the injection
        // file and calls its export at the top of the chunk, while the injection file imports a runtime
        // helper that is not defined until further down. The cycle resolves the import to `undefined`,
        // so every Sentry-enabled build dies on load with "e is not a function" before rendering.
        //
        // Only bites deployed environments — the plugin is skipped without SENTRY_* credentials, so
        // local builds look fine. Sourcemaps still resolve: debug IDs are injected per chunk
        // independently of this. Remove once the plugin is upgraded to a Rolldown-aware version.
        release: { inject: false },
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

  return defineConfig({
    envDir: envDir,
    publicDir: 'public',
    // Vite 8 switched to Rolldown, which aligns CJS interop to esbuild's semantics: a default
    // import of a CJS module now yields the module namespace object rather than its
    // `exports.default`. This app default-imports CJS modules that ship no `exports` map
    // (`@mui/icons-material/<Icon>` chief among them), so every such icon would render as an
    // object and throw React error #130. Restore the pre-Vite-8 behavior until those imports
    // are migrated.
    legacy: {
      inconsistentCjsInterop: true,
    },
    plugins: plugins,
    server: {
      open: !process.env.VITE_NO_OPEN,
      host: '0.0.0.0',
      port: env.PORT ? parseInt(env.PORT) : undefined,
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
    build: {
      outDir: './build',
      target: browserslistToEsbuild(),
      // Only emit sourcemaps when they'll actually be uploaded to Sentry.
      // Generating them for every env (e2e*, local) bloats rollup's
      // "rendering chunks" phase and OOMs the build on a 23k-module app.
      sourcemap: shouldUploadSentrySourceMaps,
    },
    define: {
      // Chime SDK background-filter deps reference the Node.js `global` which doesn't exist in browsers.
      global: 'globalThis',
    },
    resolve: {
      preserveSymlinks: true,
      tsconfigPaths: true,
      alias: [
        // Resolve the workspace packages to their real source directories. `preserveSymlinks`
        // otherwise resolves them inside node_modules, where vite treats them as prebundlable
        // deps: it serves their source raw and, with it, their transitive deps — which is fatal
        // for CJS ones like `prop-types` (reached via react-imask) that have no named exports.
        { find: /^utils(\/|$)/, replacement: path.resolve(coreRoot, 'packages/utils') + '/' },
        { find: /^ui-components(\/|$)/, replacement: path.resolve(coreRoot, 'packages/ui-components') + '/' },
        { find: '@ehrTheme', replacement: path.resolve(__dirname, env.THEME_PATH || 'src/themes/ottehr') },
        { find: '@ehrDefaultTheme', replacement: path.resolve(__dirname, 'src/themes/ottehr') },
      ],
    },
  });
};
