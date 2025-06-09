import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig, loadEnv, UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import svgr from 'vite-plugin-svgr';
import * as path from 'path';
import { existsSync } from 'fs';

export default ({ mode }: { mode: string }): UserConfig => {
  const envDir = './env';
  const env = loadEnv(mode, path.join(process.cwd(), envDir), '');

  const plugins = [react(), viteTsconfigPaths(), svgr()];

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
    plugins: plugins,
    server: {
      open: !process.env.VITE_NO_OPEN,
      host: '0.0.0.0',
      port: env.PORT ? parseInt(env.PORT) : undefined,
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
    },
    resolve: {
      alias: {
        '@theme': path.resolve(__dirname, env.THEME_PATH || '/src/themes/ottehr'),
        '@defaultTheme': path.resolve(__dirname, '/src/themes/ottehr'),
      },
    },
  });
};
