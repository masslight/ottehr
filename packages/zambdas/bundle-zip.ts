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

const ZIP_ENTRY_MODE = 0o100644;

interface EntryOptions extends Partial<yazl.Options> {
  compressionLevel: number;
}

const ENTRY_OPTIONS: EntryOptions = { mtime: ZIP_ENTRY_DATE, mode: ZIP_ENTRY_MODE, compressionLevel: 1 };

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
