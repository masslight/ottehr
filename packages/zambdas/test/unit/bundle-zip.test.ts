import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { zipZambda } from '../../bundle-zip';

// Terraform decides whether to re-upload a Zambda by diffing the zip's
// checksum, so a build that packs the same inputs into a byte-different zip
// re-deploys code that never changed. These tests pin the two ways that used
// to happen: entries landing in a different order, and entry timestamps
// following the clock.

const ASSET_NAMES = [
  'DancingScript-Regular.otf',
  'Rubik-Regular.otf',
  'abnormal.png',
  'fonts/rubik/OFL.txt',
  'fonts/rubik/Rubik-Variable.ttf',
  'logo.png',
  'statements/statement-template.html',
];

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-zip-'));
const sourceFile = path.join(root, 'index.js');
const assets = ASSET_NAMES.map((name) => ({ name, contents: Buffer.from(`contents of ${name}`) }));

const buildZip = async (outName: string): Promise<Buffer> => {
  const outPath = path.join(root, outName);
  await zipZambda(sourceFile, 'assets', assets, outPath);
  return fs.readFileSync(outPath);
};

const sha256 = (contents: Buffer): string => crypto.createHash('sha256').update(contents).digest('hex');

/** Entry names in the order the zip's central directory lists them. */
const entryNames = (zip: Buffer): string[] => {
  let eocd = zip.length - 22;
  while (eocd >= 0 && zip.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('no end-of-central-directory record');

  const count = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    names.push(zip.toString('utf8', offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
};

beforeAll(() => {
  fs.writeFileSync(sourceFile, 'exports.index=async()=>({statusCode:200});');
});

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('zipZambda', () => {
  it('produces the same bytes for every zip built concurrently from the same inputs', async () => {
    // The zips of a chunk are built with Promise.all, which is what made the
    // old implementation flaky: it handed archiver paths to read later, and
    // under concurrency those reads finished in whatever order they landed.
    const builds = await Promise.all(Array.from({ length: 12 }, (_, i) => buildZip(`concurrent-${i}.zip`)));

    expect(new Set(builds.map(sha256)).size).toBe(1);
  });

  it('writes the assets in the order they were passed', async () => {
    const names = entryNames(await buildZip('ordered.zip'));

    expect(names).toContain('index.js');
    expect(names.filter((name) => name !== 'index.js')).toEqual(ASSET_NAMES.map((name) => `assets/${name}`));
  });

  it('ignores the source file mtime so a rebuild of unchanged code matches', async () => {
    const before = await buildZip('mtime-before.zip');

    const anHourLater = new Date(Date.now() + 60 * 60 * 1000);
    fs.utimesSync(sourceFile, anHourLater, anHourLater);
    const after = await buildZip('mtime-after.zip');

    expect(sha256(after)).toBe(sha256(before));
  });

  it('packs a zambda that needs no assets', async () => {
    const outPath = path.join(root, 'no-assets.zip');
    await zipZambda(sourceFile, 'assets', [], outPath);

    expect(entryNames(fs.readFileSync(outPath))).toEqual(['index.js']);
  });
});
