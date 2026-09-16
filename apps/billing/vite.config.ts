import react from '@vitejs/plugin-react';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import { existsSync } from 'fs';
import * as path from 'path';
import { defineConfig, loadEnv, UserConfig } from 'vite';

export default ({ mode }: { mode: string }): UserConfig => {
  const envDir = './env';
  const env = loadEnv(mode, path.join(process.cwd(), envDir), '');

  const tlsCert = existsSync(path.join(process.cwd(), envDir, 'cert.pem'));
  const tlsKey = existsSync(path.join(process.cwd(), envDir, 'key.pem'));

  // Only emit sourcemaps when they'd be uploaded to Sentry. Otherwise rollup's
  // "rendering chunks" phase bloats memory and OOMs the build for no benefit.
  const shouldUploadSentrySourceMaps =
    Boolean(env.SENTRY_AUTH_TOKEN) && Boolean(env.SENTRY_ORG) && Boolean(env.SENTRY_PROJECT);

  return defineConfig({
    envDir,
    plugins: [react()],
    resolve: {
      tsconfigPaths: true,
      preserveSymlinks: true,
      // Resolve the workspace packages to their real source directories. `preserveSymlinks`
      // otherwise resolves them inside node_modules, where vite treats them as prebundlable deps:
      // it serves their source raw and, with it, their transitive deps — fatal for CJS ones like
      // `prop-types` (reached via react-imask) that have no named exports to give.
      alias: [
        { find: /^utils(\/|$)/, replacement: path.resolve(__dirname, '../../packages/utils') + '/' },
        { find: /^ui-components(\/|$)/, replacement: path.resolve(__dirname, '../../packages/ui-components') + '/' },
      ],
    },
    server: {
      open: !process.env.VITE_NO_OPEN,
      host: '0.0.0.0',
      port: env.PORT ? parseInt(env.PORT) : 5002,
      https: tlsCert && tlsKey ? { cert: './env/cert.pem', key: './env/key.pem' } : undefined,
    },
    build: {
      outDir: './build',
      target: browserslistToEsbuild(),
      sourcemap: shouldUploadSentrySourceMaps,
    },
  });
};
