/**
 * Packs one Zambda into the zip that gets uploaded.
 *
 * Kept separate from bundle.ts so the packing can be unit tested. The zip's
 * checksum is what Terraform diffs against the deployed Zambda, so a build that
 * packs the same inputs differently on two runs re-uploads code that never
 * changed — see bundle-zip.test.ts.
 */
import archiver from 'archiver';
import fs from 'fs';

export interface ZipAsset {
  /** Path inside the assets tree, e.g. `fonts/rubik/Rubik-Variable.ttf`. */
  name: string;
  contents: Buffer;
}

/** Fixed so entry timestamps never make an otherwise identical zip differ. */
export const ZIP_ENTRY_DATE = new Date('2025-01-01');

/**
 * Assets are appended as buffers rather than by path. `archive.file()` defers
 * reading, and with several of them queued the entries can finish out of order,
 * so two builds of the same commit produce zips that differ only in entry order
 * — enough to change the checksum and force a pointless re-upload. (Measured:
 * 20 concurrent zips from identical inputs gave 6 distinct hashes via `file()`,
 * 1 via `append()`.) Appending buffers keeps the order the caller asked for.
 * index.js stays a `file()` so the bundle is streamed rather than held in
 * memory, which is why it lands after the assets rather than first.
 */
export const zipZambda = async (
  sourceFilePath: string,
  assetsPath: string,
  assets: ZipAsset[],
  outPath: string
): Promise<void> => {
  const archive = archiver('zip', { zlib: { level: 1 } });
  const stream = fs.createWriteStream(outPath);

  return new Promise((resolve, reject) => {
    let result = archive;
    result = result.file(sourceFilePath, { name: 'index.js', date: ZIP_ENTRY_DATE });
    for (const asset of assets) {
      result = result.append(asset.contents, { name: `${assetsPath}/${asset.name}`, date: ZIP_ENTRY_DATE });
    }
    result.on('error', (err) => reject(err)).pipe(stream);

    stream.on('close', () => resolve());
    void archive.finalize();
  });
};
