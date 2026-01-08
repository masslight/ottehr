import { sentryEsbuildPlugin } from '@sentry/esbuild-plugin';
import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import { type Options } from 'execa';
import path from 'path';

const pathToSentryEnvFile = path.resolve(__dirname, '.env/sentry.json');

interface SentryConfig {
  authToken: string;
  org: string;
  project: string;
}

const loadSentryConfiguration = async (): Promise<SentryConfig> => {
  const sentryConfig = await import(pathToSentryEnvFile);
  if (!sentryConfig.authToken || !sentryConfig.org || !sentryConfig.project) {
    console.error('Invalid sentry config!');
  }

  return sentryConfig;
};

const injectSourceMaps = async (sentryConfig: SentryConfig): Promise<void> => {
  // dynamic import because this library is pure ESM
  const { $ } = await import('execa');
  const sentryEnv = {
    SENTRY_ORG: sentryConfig.org,
    SENTRY_PROJECT: sentryConfig.project,
    SENTRY_AUTH_TOKEN: sentryConfig.authToken,
  };
  const shellConfig: Options = {
    env: sentryEnv,
    stdio: 'inherit',
    preferLocal: true,
  };
  const revParse = await $`git rev-parse --verify HEAD`;
  const releaseName = revParse.stdout;
  await $(shellConfig)`sentry-cli releases new ${releaseName}`;
  await $(shellConfig)`sentry-cli sourcemaps inject .dist --quiet --log-level error`;
  await $(shellConfig)`sentry-cli sourcemaps upload --strict --release ${releaseName} .dist`;
  await $(shellConfig)`sentry-cli releases finalize ${releaseName}`;
};

const main = async (): Promise<void> => {
  console.log('Loading Sentry configuration...');
  const sentryConfig = await loadSentryConfiguration();

  console.log('the sentry config, ', sentryConfig);
  console.log('Bundling...');
  console.time('Bundle time');
  await esbuild
    .build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      outdir: '.dist',
      sourcemap: true,
      platform: 'node',
      treeShaking: true,
      plugins: [
        copy({
          resolveFrom: 'cwd',
          assets: {
            from: '.env',
            to: '.dist/.env',
          },
        }),
        sentryEsbuildPlugin({
          authToken: sentryConfig.authToken,
          org: sentryConfig.org,
          project: sentryConfig.project,
          sourcemaps: {
            // if enabled, creates unstable js builds, so we will add debug IDs using CLI
            // see this issue for more information https://github.com/getsentry/sentry-javascript-bundler-plugins/issues/500
            disable: true,
          },
          release: {
            // if enabled, creates unstable js builds, so we will create releases using CLI
            inject: false,
          },
        }),
      ],
    })
    .catch((error) => {
      console.log(error);
      process.exit(1);
    });
  console.timeEnd('Bundle time');

  console.log('Source maps...');
  console.time('Source maps time');
  await injectSourceMaps(sentryConfig);
  console.timeEnd('Source maps time');
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
