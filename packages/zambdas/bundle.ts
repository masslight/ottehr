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

const build = async (zambdas: ZambdaSpec[]): Promise<void> => {
  const sources = zambdas.map((zambda) => `${zambda.src}.ts`);
  await esbuild
    .build({
      entryPoints: sources,
      bundle: true,
      outdir: '.dist',
      sourcemap: true,
      platform: 'node',
      external: ['@aws-sdk/*'],
      treeShaking: true,
      plugins: [
        copy({
          resolveFrom: 'cwd',
          assets: {
            from: ['assets/*'],
            to: ['.dist/assets'],
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

const zipZambda = async (sourceFilePath: string, assetsDir: string, outPath: string): Promise<void> => {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = fs.createWriteStream(outPath);

  return new Promise((resolve, reject) => {
    let result = archive;
    result = result.file(sourceFilePath, { name: 'index.js' });
    result = result.directory(assetsDir, 'assets');
    result.on('error', (err) => reject(err)).pipe(stream);

    stream.on('close', () => resolve());
    void archive.finalize();
  });
};

const zip = async (zambdas: ZambdaSpec[]): Promise<void> => {
  const zipsDir = '.dist/zips';
  if (!fs.existsSync(zipsDir)) {
    fs.mkdirSync(zipsDir);
  }

  const assetsDir = '.dist/assets';

  await Promise.all(
    zambdas.map((zambda) => {
      const sourceDir = `.dist/${zambda.src.substring('src/'.length)}.js`;
      return zipZambda(sourceDir, assetsDir, zambda.zip);
    })
  );
};

const main = async (): Promise<void> => {
  console.log('Starting to bundle and zip Zambdas...');
  const zambdas = zambdasList();
  console.log('Bundling...');
  console.time('Bundle time');
  await build(zambdas);
  console.timeEnd('Bundle time');
  console.log('Zipping...');
  console.time('Zip time');
  await zip(zambdas);
  console.timeEnd('Zip time');
  console.log('Zambdas successfully bundled and zipped into .dist/zips');
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
