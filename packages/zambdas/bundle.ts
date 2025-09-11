import { sentryEsbuildPlugin } from '@sentry/esbuild-plugin';
import archiver from 'archiver';
import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import { type Options } from 'execa';
import fs from 'fs';
import ottehrSpec from '../../config/oystehr/ottehr-spec.json';

interface ZambdaSpec {
  name: string;
  type: string;
  runtime: string;
  src: string;
  zip: string;
}

const zambdasList = (): ZambdaSpec[] => {
  return Object.entries(ottehrSpec.zambdas).map(([_key, spec]) => {
    return spec;
  });
};

const build = async (
  zambdas: ZambdaSpec[],
  assetsFrom: string[],
  assetsTo: string[],
  outdir: string
): Promise<void> => {
  const sources = zambdas.map((zambda) => `${zambda.src}.ts`);
  await esbuild
    .build({
      entryPoints: sources,
      bundle: true,
      outdir,
      sourcemap: true,
      platform: 'node',
      external: ['@aws-sdk/*'],
      treeShaking: true,
      plugins: [
        copy({
          resolveFrom: 'cwd',
          assets: {
            from: assetsFrom,
            to: assetsTo,
          },
        }),
        sentryEsbuildPlugin({
          authToken: process.env.SENTRY_AUTH_TOKEN,
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
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
};

const injectSourceMaps = async (): Promise<void> => {
  if (!process.env.SENTRY_ORG || !process.env.SENTRY_PROJECT || !process.env.SENTRY_AUTH_TOKEN) {
    console.warn('Sentry environment variables are not set');
    return;
  }
  // dynamic import because this library is pure ESM
  const { $ } = await import('execa');
  const sentryEnv = {
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
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

const zipZambda = async (
  sourceFilePath: string,
  assetsDir: string,
  assetsPath: string,
  outPath: string
): Promise<void> => {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = fs.createWriteStream(outPath);

  return new Promise((resolve, reject) => {
    let result = archive;
    result = result.file(sourceFilePath, { name: 'index.js', date: new Date('2025-01-01') });
    result = result.directory(assetsDir, assetsPath, { date: new Date('2025-01-01') });
    result.on('error', (err) => reject(err)).pipe(stream);

    stream.on('close', () => resolve());
    void archive.finalize();
  });
};

const zip = async (zambdas: ZambdaSpec[], assetsDir: string, assetsPath: string): Promise<void> => {
  const zipsDir = '.dist/zips';
  if (!fs.existsSync(zipsDir)) {
    fs.mkdirSync(zipsDir);
  }

  await Promise.all(
    zambdas.map((zambda) => {
      const sourceDir = `.dist/${zambda.src.substring('src/'.length)}.js`;
      return zipZambda(sourceDir, assetsDir, assetsPath, zambda.zip);
    })
  );
};

const main = async (): Promise<void> => {
  console.log('Starting to bundle and zip Zambdas...');
  const { $ } = await import('execa');
  await $({ stdio: 'inherit' })`rm -rf ./.dist`;
  const zambdas = zambdasList();
  console.log('Bundling...');
  console.time('Bundle time');
  const icd10SearchZambda = zambdas.filter((zambda) => zambda.name === 'icd-10-search');
  const icd10AssetDir = '.dist/icd-10-cm-tabular';
  await build(icd10SearchZambda, ['icd-10-cm-tabular/*'], [icd10AssetDir], '.dist/ehr/icd-10-search');
  const mostZambdas = zambdas.filter((zambda) => zambda.name !== 'icd-10-search');
  const assetsDir = '.dist/assets';
  await build(mostZambdas, ['assets/*'], [assetsDir], '.dist');
  console.timeEnd('Bundle time');
  console.log('Source maps...');
  console.time('Source maps time');
  await injectSourceMaps();
  console.timeEnd('Source maps time');
  console.log('Zipping...');
  console.time('Zip time');
  await zip(icd10SearchZambda, icd10AssetDir, 'icd-10-cm-tabular');
  await zip(mostZambdas, assetsDir, 'assets');
  console.timeEnd('Zip time');
  console.log('Zambdas successfully bundled and zipped into .dist/zips');
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
