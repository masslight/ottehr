import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findBundlesThatFailToLoad } from '../../bundle-load-check';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-load-check-'));
const bundle = (name: string): string => path.join(root, `${name}.js`);

beforeAll(() => {
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}\n');
  fs.writeFileSync(bundle('loads'), 'export const index = async () => ({ statusCode: 200 });');
  fs.writeFileSync(bundle('no-index'), 'export const handler = async () => ({ statusCode: 200 });');
  fs.writeFileSync(bundle('throws'), "throw new Error('boom while loading'); export const index = () => undefined;");
  // What a bundled CommonJS dependency does when the createRequire banner is missing.
  fs.writeFileSync(bundle('requires'), "const fs = require('fs'); export const index = async () => fs;");
});

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('findBundlesThatFailToLoad', () => {
  it('passes a bundle that loads and exports an index handler', async () => {
    expect(await findBundlesThatFailToLoad([bundle('loads')])).toEqual([]);
  });

  it('reports bundles that throw while loading or have no index handler', async () => {
    const failures = await findBundlesThatFailToLoad([bundle('loads'), bundle('no-index'), bundle('throws')]);

    expect(failures.map((failure) => failure.bundlePath).sort()).toEqual([bundle('no-index'), bundle('throws')]);
    expect(failures.find((failure) => failure.bundlePath === bundle('no-index'))?.error).toContain(
      'does not export an index handler'
    );
    expect(failures.find((failure) => failure.bundlePath === bundle('throws'))?.error).toContain('boom while loading');
  });

  it('does not give the bundle a require it would not have in Lambda', async () => {
    const [failure] = await findBundlesThatFailToLoad([bundle('requires')]);

    expect(failure?.error).toContain('require is not defined');
  });
});
