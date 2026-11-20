import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as prettier from 'prettier';
import {
  CvxVaccine,
  MvxManufacturer,
  NdcVaccineProduct,
  parseCdcCvx,
  parseCdcMvx,
  parseCdcNdcLookup,
} from 'utils/lib/types/data/immunization/vaccine-codes';

// Builds the vaccine catalog's code tables from CDC's published code sets: the CVX vaccines a practice can
// add, the active MVX manufacturers, and the NDC crosswalk rows for those vaccines.
//
//   npm run codes:vaccines:refresh   download CDC's current files into scripts/data/cdc-vaccines/, then regenerate
//   npm run codes:vaccines           regenerate from the committed files (after changing a filter)
//
// The source files are committed exactly as CDC serves them, and sources.json records where and when each
// came from and its SHA-256. A unit test in utils (vaccine-codes.test.ts) fails when a source file no longer
// matches sources.json or a committed table no longer matches its source. See scripts/data/cdc-vaccines/README.md.

const SOURCE_DIR = path.resolve(__dirname, 'data/cdc-vaccines');
const TARGET_DIR = path.resolve(__dirname, '../packages/utils/lib/types/data/immunization');
const MANIFEST = path.join(SOURCE_DIR, 'sources.json');

const CDC_DOWNLOADS = 'https://www2a.cdc.gov/vaccines/iis/iisstandards/downloads';
const SOURCES = {
  cvx: { file: 'cvx.txt', url: `${CDC_DOWNLOADS}/cvx.txt` },
  mvx: { file: 'mvx.txt', url: `${CDC_DOWNLOADS}/mvx.txt` },
  ndc: { file: 'cdc-ndc-lookup.txt', url: `${CDC_DOWNLOADS}/NDC/get_all_ndc_display.txt` },
};

/** Packages whose sale ended before this date are left out of the NDC table. */
export const NDC_KEEP_ENDED_SINCE = '2024-01-01';

interface Tables {
  cvx: CvxVaccine[];
  mvx: MvxManufacturer[];
  ndc: NdcVaccineProduct[];
}

/** sources.json: one entry per source file, keyed by file name. */
type Manifest = Record<string, { url: string; retrievedAt: string; bytes: number; sha256: string }>;

function buildTables(read: (file: string) => string): Tables {
  const parse = <T>(file: string, parser: (text: string) => T): T => {
    try {
      return parser(read(file));
    } catch (error) {
      throw new Error(`${file}: ${error instanceof Error ? error.message : error}`);
    }
  };
  const cvx = parse(SOURCES.cvx.file, parseCdcCvx);
  const offered = new Set(cvx.map((vaccine) => vaccine.cvx));
  return {
    cvx,
    mvx: parse(SOURCES.mvx.file, parseCdcMvx),
    ndc: parse(SOURCES.ndc.file, (text) => parseCdcNdcLookup(text, offered, NDC_KEEP_ENDED_SINCE)),
  };
}

const readCommitted = (file: string): string => fs.readFileSync(path.join(SOURCE_DIR, file), 'utf-8');

/** Says which codes a refresh added, removed or reworded, so the reviewer knows where to look. */
function reportChanges<T>(label: string, before: T[], after: T[], key: (row: T) => string): void {
  const old = new Map(before.map((row) => [key(row), JSON.stringify(row)]));
  const now = new Map(after.map((row) => [key(row), JSON.stringify(row)]));
  const lists = {
    added: [...now.keys()].filter((code) => !old.has(code)),
    removed: [...old.keys()].filter((code) => !now.has(code)),
    changed: [...now.keys()].filter((code) => old.has(code) && old.get(code) !== now.get(code)),
  };
  const details = Object.entries(lists)
    .filter(([, codes]) => codes.length)
    .map(([change, codes]) => `${change} ${codes.join(', ')}`);
  console.log(`${label}: ${before.length} → ${after.length} rows; ${details.join('; ') || 'no changes'}`);
}

async function download(): Promise<void> {
  let before: Tables | undefined;
  try {
    before = buildTables(readCommitted);
  } catch {
    // No usable earlier download to compare with.
  }

  const downloads: { file: string; url: string; body: Buffer }[] = [];
  for (const { file, url } of Object.values(SOURCES)) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} answered HTTP ${response.status}`);
    downloads.push({ file, url, body: Buffer.from(await response.arrayBuffer()) });
  }

  // Nothing is written until all three downloads parse: an error page, a truncated file or a changed layout
  // throws here and leaves the committed files as they were.
  const utf8 = new TextDecoder('utf-8', { fatal: true });
  const after = buildTables((file) => utf8.decode(downloads.find((source) => source.file === file)?.body));

  const manifest: Manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf-8')) : {};
  const today = new Date().toISOString().slice(0, 10);
  for (const { file, url, body } of downloads) {
    const sha256 = createHash('sha256').update(body).digest('hex');
    const recorded = manifest[file];
    fs.writeFileSync(path.join(SOURCE_DIR, file), body);
    if (recorded?.sha256 === sha256 && recorded.url === url) {
      console.log(`${file}: unchanged at CDC since ${recorded.retrievedAt}`);
    } else {
      manifest[file] = { url, retrievedAt: today, bytes: body.length, sha256 };
      console.log(`${file}: downloaded ${body.length} bytes`);
    }
  }
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  if (before) {
    reportChanges('CVX vaccines', before.cvx, after.cvx, (vaccine) => vaccine.cvx);
    reportChanges('MVX manufacturers', before.mvx, after.mvx, (manufacturer) => manufacturer.mvx);
    reportChanges('NDC packages', before.ndc, after.ndc, (product) => `${product.saleNdc}/${product.useNdc ?? ''}`);
  }
}

async function write(
  target: string,
  header: string[],
  exportName: string,
  type: string,
  rows: unknown[]
): Promise<void> {
  const source = [
    ...header.map((line) => `// ${line}`),
    `import type { ${type} } from './vaccine-codes';`,
    '',
    `export const ${exportName}: readonly ${type}[] = [`,
    ...rows.map((row) => `  ${JSON.stringify(row)},`),
    '];',
    '',
  ].join('\n');
  const file = path.join(TARGET_DIR, target);
  const config = await prettier.resolveConfig(file);
  fs.writeFileSync(file, await prettier.format(source, { ...config, filepath: file }));
  console.log(`Wrote ${rows.length} rows to ${path.relative(process.cwd(), file)}`);
}

async function main(): Promise<void> {
  if (process.argv.includes('--download')) await download();

  const generated = 'Generated by `npm run codes:vaccines` from scripts/data/cdc-vaccines/ — do not edit by hand.';
  const tables = buildTables(readCommitted);
  await write(
    'cvx-vaccines.generated.ts',
    ['The vaccines a practice can add in the In-House Medications catalog: current US CVX codes.', generated],
    'CVX_VACCINES',
    'CvxVaccine',
    tables.cvx
  );
  await write(
    'mvx-manufacturers.generated.ts',
    ['Active vaccine manufacturers (CDC MVX codes).', generated],
    'MVX_MANUFACTURERS',
    'MvxManufacturer',
    tables.mvx
  );
  await write(
    'ndc-vaccines.generated.ts',
    ['CDC NDC crosswalk rows for the offered vaccines: which box is which vaccine from which manufacturer.', generated],
    'NDC_VACCINE_PRODUCTS',
    'NdcVaccineProduct',
    tables.ndc
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
