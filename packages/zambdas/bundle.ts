import { sentryEsbuildPlugin } from '@sentry/esbuild-plugin';
import archiver from 'archiver';
import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import fs from 'fs';
import ottehrSpec from '../../config/ottehr-spec.json';

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
          // debug: true,
        }),
      ],
    })
    .catch((error) => {
      console.log(error);
      process.exit(1);
    });
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
    result = result.file(sourceFilePath, { name: 'index.js' });
    result = result.directory(assetsDir, assetsPath);
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
  const zambdas = zambdasList();
  console.log('Bundling...');

  const icd10SearchZambda = zambdas.filter((zambda) => zambda.name === 'icd-10-search');
  const icd10AssetDir = '.dist/icd-10-cm-tabular';
  await build(icd10SearchZambda, ['icd-10-cm-tabular/*'], [icd10AssetDir], '.dist/ehr/icd-10-search');
  const mostZambdas = zambdas.filter((zambda) => zambda.name !== 'icd-10-search');
  const assetsDir = '.dist/assets';
  await build(mostZambdas, ['assets/*'], [assetsDir], '.dist');
  console.timeEnd('Bundle time');
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
