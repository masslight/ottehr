/**
 * Packs one Zambda into the zip that gets uploaded.
 *
 * Kept separate from bundle.ts so the packing can be unit tested. The zip's
 * checksum is what Terraform diffs against the deployed Zambda, so a build that
 * packs the same inputs differently on two runs re-uploads code that never
 * changed — see bundle-zip.test.ts.
 */
import fs from 'fs';
import * as yazl from 'yazl';

export interface ZipAsset {
  /** Path inside the assets tree, e.g. `fonts/rubik/Rubik-Variable.ttf`. */
  name: string;
  contents: Buffer;
}

/** Fixed so entry timestamps never make an otherwise identical zip differ. */
export const ZIP_ENTRY_DATE = new Date('2025-01-01');

/**
 * Also fixed for the checksum's sake: left unset, yazl stamps whatever the
 * source file's own permission bits happen to be, which vary with the umask of
 * whoever ran the build.
 */
const ZIP_ENTRY_MODE = 0o100644;

/** `@types/yazl` predates `compressionLevel`; `compress` only picks between off and zlib's default of 6. */
interface EntryOptions extends Partial<yazl.Options> {
  compressionLevel: number;
}

/**
 * Matches what archiver was configured with. The bundles are megabytes of
 * already-minified JS built for every Zambda on every deploy, so the cheap
 * level is the right trade.
 */
const ENTRY_OPTIONS: EntryOptions = { mtime: ZIP_ENTRY_DATE, mode: ZIP_ENTRY_MODE, compressionLevel: 1 };

/**
 * Entry order is the caller's, not the order the reads and deflates finish in:
 * yazl appends each entry to its queue synchronously and writes strictly the
 * first one not yet done, so a zip of the same inputs is byte-identical however
 * the async work interleaves. archiver, which this replaced, deferred `file()`
 * reads and emitted them in completion order — 20 concurrent zips of identical
 * inputs gave 6 distinct hashes, each a pointless re-upload. index.js is added
 * by path so the bundle is streamed rather than held in memory.
 */
export const zipZambda = async (
  sourceFilePath: string,
  assetsPath: string,
  assets: ZipAsset[],
  outPath: string
): Promise<void> => {
  const zip = new yazl.ZipFile();
  const stream = fs.createWriteStream(outPath);

  return new Promise((resolve, reject) => {
    zip.on('error', reject);
    stream.on('error', reject);
    stream.on('close', () => resolve());

    zip.outputStream.pipe(stream);

    zip.addFile(sourceFilePath, 'index.js', ENTRY_OPTIONS);
    for (const asset of assets) {
      zip.addBuffer(asset.contents, `${assetsPath}/${asset.name}`, ENTRY_OPTIONS);
    }
    zip.end();
  });
};
