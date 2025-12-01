import { sentryEsbuildPlugin } from '@sentry/esbuild-plugin';
import archiver from 'archiver';
import * as esbuild from 'esbuild';
import { type Options } from 'execa';
import fs from 'fs';
import path from 'path';
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

const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

const BUNDLE_CHUNK_SIZE = 35;
const ZIP_CHUNK_SIZE = 20;

const getSentryPlugins = (isSentryEnabled: boolean): esbuild.Plugin[] => {
  if (!isSentryEnabled) return [];
  return [
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
  ];
};

const buildZambdaWithContext = async (zambda: ZambdaSpec, outdir: string, isSentryEnabled: boolean): Promise<void> => {
  const outfile = `${outdir}/${zambda.src.substring('src/'.length)}.js`;

  const ctx = await esbuild.context({
    entryPoints: [`${zambda.src}.ts`],
    bundle: true,
    outfile,
    sourcemap: isSentryEnabled,
    platform: 'node',
    external: ['@aws-sdk/*'],
    treeShaking: true,
    plugins: getSentryPlugins(isSentryEnabled),
  });

  try {
    await ctx.rebuild();
  } catch (error) {
    console.log(`Error bundling ${zambda.name}:`, error);
    process.exit(1);
  } finally {
    await ctx.dispose();
  }
};

// Build zambdas in chunks sequentially to manage memory usage
const buildZambdasInChunks = async (zambdas: ZambdaSpec[], outdir: string, isSentryEnabled: boolean): Promise<void> => {
  const uniqueDirs = new Set(
    zambdas.map((zambda) => path.dirname(`${outdir}/${zambda.src.substring('src/'.length)}.js`))
  );

  await Promise.all(Array.from(uniqueDirs).map((dir) => fs.promises.mkdir(dir, { recursive: true }).catch(() => {})));

  const chunks = chunkArray(zambdas, BUNDLE_CHUNK_SIZE);
  console.log(`Bundling ${zambdas.length} zambdas in ${chunks.length} chunks of up to ${BUNDLE_CHUNK_SIZE}...`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Bundling chunk ${i + 1}/${chunks.length} (${chunk.length} zambdas)...`);
    await Promise.all(chunk.map((zambda) => buildZambdaWithContext(zambda, outdir, isSentryEnabled)));
  }
};

const copyAssets = async (from: string, to: string): Promise<void> => {
  if (!fs.existsSync(from)) {
    console.warn(`Assets directory ${from} does not exist, skipping copy`);
    return;
  }

  const { $ } = await import('execa');
  try {
    await $`cp -r ${from} ${to}`;
  } catch (error) {
    console.error(`Failed to copy assets from ${from} to ${to}:`, error);
    throw error;
  }
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

const zipInChunks = async (zambdas: ZambdaSpec[], assetsDir: string, assetsPath: string): Promise<void> => {
  const chunks = chunkArray(zambdas, ZIP_CHUNK_SIZE);
  console.log(`Zipping ${zambdas.length} zambdas in ${chunks.length} chunks of up to ${ZIP_CHUNK_SIZE}...`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Zipping chunk ${i + 1}/${chunks.length} (${chunk.length} zambdas)...`);
    await Promise.all(
      chunk.map((zambda) => {
        const sourceDir = `.dist/${zambda.src.substring('src/'.length)}.js`;
        return zipZambda(sourceDir, assetsDir, assetsPath, zambda.zip);
      })
    );
  }
};

const main = async (): Promise<void> => {
  console.log('Starting to bundle and zip Zambdas...');
  const { $ } = await import('execa');

  await $({ stdio: 'inherit' })`rm -rf ./.dist`;
  await fs.promises.mkdir('.dist/zips', { recursive: true });

  const zambdas = zambdasList();
  console.log('Bundling...');
  console.time('Bundle time');

  const zambdasWithIcd10Search = ['icd-10-search', 'radiology-create-order'];
  const icd10AssetDir = '.dist/icd-10-cm-tabular';
  const assetsDir = '.dist/assets';

  const isSentryEnabled = !['local', 'e2e'].includes(process.env.ENV || '');

  const icd10Zambdas = zambdas.filter((zambda) => zambdasWithIcd10Search.includes(zambda.name));
  const regularZambdas = zambdas.filter((zambda) => !zambdasWithIcd10Search.includes(zambda.name));

  await buildZambdasInChunks(zambdas, '.dist', isSentryEnabled);

  console.log('Copying assets...');
  await Promise.all([copyAssets('icd-10-cm-tabular', icd10AssetDir), copyAssets('assets', assetsDir)]);

  console.timeEnd('Bundle time');
  if (isSentryEnabled) {
    console.log('Source maps...');
    console.time('Source maps time');
    await injectSourceMaps();
    console.timeEnd('Source maps time');
  }
  console.log('Zipping...');
  console.time('Zip time');

  await Promise.all([
    zipInChunks(icd10Zambdas, icd10AssetDir, 'icd-10-cm-tabular'),
    zipInChunks(regularZambdas, assetsDir, 'assets'),
  ]);

  console.timeEnd('Zip time');
  console.log('Zambdas successfully bundled and zipped into .dist/zips');
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
