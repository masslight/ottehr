import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import { assetsRequiredBy, listAssetFiles } from '../../bundle-assets';

// Mirrors the real tree: flat files, a nested font directory with its licence,
// and a directory whose file names are only known at runtime.
const ASSETS = [
  'Rubik-Regular.otf',
  'Rubik-Medium.ttf',
  'DancingScript-Regular.otf',
  'logo.png',
  'abnormal.png',
  'fonts/rubik/Rubik-Variable.ttf',
  'fonts/rubik/OFL.txt',
  'statements/statement-template.html',
].sort();

describe('assetsRequiredBy', () => {
  it('ships nothing for a bundle that never touches assets', () => {
    expect(assetsRequiredBy('export const handler=async()=>({statusCode:200});', ASSETS)).toEqual([]);
  });

  it('picks up assets referenced as a literal path', () => {
    // How most PDF code reads them: fs.readFileSync('./assets/Rubik-Regular.otf')
    const bundle = 'var a=n.readFileSync("./assets/Rubik-Regular.otf"),b=n.readFileSync("./assets/logo.png");';
    expect(assetsRequiredBy(bundle, ASSETS)).toEqual(['Rubik-Regular.otf', 'logo.png'].sort());
  });

  it('picks up assets nested below the assets root', () => {
    const bundle = 'var f="Rubik-Variable.ttf";';
    // The licence comes along with the font it belongs to.
    expect(assetsRequiredBy(bundle, ASSETS)).toEqual(['fonts/rubik/OFL.txt', 'fonts/rubik/Rubik-Variable.ttf']);
  });

  it('does not drag in the licence of a directory it took nothing from', () => {
    expect(assetsRequiredBy('var a="./assets/logo.png";', ASSETS)).toEqual(['logo.png']);
  });

  it('ships the whole tree when a path is assembled from segments', () => {
    // getHTMLStatementTemplate takes the file name from a request parameter, so
    // the built output only contains the directory segments. Guessing here would
    // mean a runtime read of a file that is not in the zip.
    const bundle = 'var p=o.resolve(process.cwd(),"assets","statements",t);';
    expect(assetsRequiredBy(bundle, ASSETS)).toEqual(ASSETS);
  });

  it('ships the whole tree when a path is concatenated onto the directory', () => {
    // './assets/' + name leaves a literal that stops at the separator.
    expect(assetsRequiredBy('var p="./assets/"+t;', ASSETS)).toEqual(ASSETS);
    expect(assetsRequiredBy('var p="assets/"+t;', ASSETS)).toEqual(ASSETS);
  });

  it('treats a complete literal path as resolved, not as concatenation', () => {
    expect(assetsRequiredBy('var p="./assets/logo.png";', ASSETS)).toEqual(['logo.png']);
  });

  it('ships the whole tree even when some names also resolve literally', () => {
    // sub-generate-statement does both; the segment-built path still wins.
    const bundle = 'var a=o.resolve(process.cwd(),"assets","Rubik-Medium.ttf");';
    expect(assetsRequiredBy(bundle, ASSETS)).toEqual(ASSETS);
  });

  it('is order-independent and deduplicated', () => {
    const bundle = 'a("./assets/logo.png");b("./assets/logo.png");c("./assets/abnormal.png");';
    expect(assetsRequiredBy(bundle, ASSETS)).toEqual(['abnormal.png', 'logo.png']);
  });
});

describe('listAssetFiles', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-assets-'));

  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it('lists nested files relative to the root, sorted', () => {
    fs.mkdirSync(path.join(root, 'fonts', 'rubik'), { recursive: true });
    fs.writeFileSync(path.join(root, 'logo.png'), 'x');
    fs.writeFileSync(path.join(root, 'abnormal.png'), 'x');
    fs.writeFileSync(path.join(root, 'fonts', 'rubik', 'OFL.txt'), 'x');

    expect(listAssetFiles(root)).toEqual(['abnormal.png', 'fonts/rubik/OFL.txt', 'logo.png']);
  });

  it('returns nothing for a directory that does not exist', () => {
    expect(listAssetFiles(path.join(root, 'nope'))).toEqual([]);
  });
});
