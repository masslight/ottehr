import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CVX_VACCINES } from './cvx-vaccines.generated';
import { MVX_MANUFACTURERS } from './mvx-manufacturers.generated';
import { CVX_NOT_OFFERED, parseCdcCvx, parseCdcMvx } from './vaccine-codes';

// scripts/data/cdc-vaccines at the repo root, relative to this file (packages/utils/lib/types/data/immunization/).
const SOURCE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../../scripts/data/cdc-vaccines');
const read = (file: string): string => readFileSync(resolve(SOURCE_DIR, file), 'utf-8');

describe('parseCdcCvx', () => {
  // cvx.txt as CDC serves it: BOM, CRLF, space-padded codes, no header row.
  const row = (cvx: string, name: string, status = 'Active', nonVaccine = 'False', notes = ''): string =>
    `${cvx.padEnd(10)}|${name}|${name}, full|${notes}|${status}|${nonVaccine}|2024/01/25`;

  it('keeps active vaccines a practice would stock, in name order, with CDC text unedited', () => {
    const vaccines = parseCdcCvx(
      [
        '\uFEFF' + row('115', 'Tdap'),
        row('03', 'MMR', 'Active', 'False', ' note '),
        row('161', 'Influenza, injectable,quadrivalent'),
        row('54', 'adenovirus, type 4', 'Inactive'),
        row('510', 'Sinopharm', 'Non-US'),
        row('86', 'IG', 'Active', 'True'),
        row('318', 'Anthrax PEP'),
        '',
      ].join('\r\n')
    );
    expect(vaccines).toEqual([
      { cvx: '161', name: 'Influenza, injectable,quadrivalent', fullName: 'Influenza, injectable,quadrivalent, full' },
      { cvx: '03', name: 'MMR', fullName: 'MMR, full', notes: 'note' },
      { cvx: '115', name: 'Tdap', fullName: 'Tdap, full' },
    ]);
    expect(CVX_NOT_OFFERED.has('318')).toBe(true);
  });

  it('fails loudly when the download is not the file we expect', () => {
    expect(() => parseCdcCvx('<html><body>Service unavailable</body></html>')).toThrow(
      'Row 1 has 1 fields, expected 7'
    );
    expect(() => parseCdcCvx('03|MMR|measles, mumps and rubella|')).toThrow('Row 1 has 4 fields, expected 7');
    expect(() => parseCdcCvx(row('ABC', 'x'))).toThrow('Malformed CVX');
    expect(() => parseCdcCvx(row('03', ''))).toThrow('has no name');
    expect(() => parseCdcCvx(row('03', 'MMR', 'Active', 'no'))).toThrow('unexpected status, non-vaccine flag or date');
    expect(() => parseCdcCvx([row('03', 'MMR'), row('03', 'MMR')].join('\r\n'))).toThrow('Duplicate CVX 03');
    expect(() => parseCdcCvx(row('03', 'MMR', 'ACTIVE'))).toThrow('No active CVX vaccines found');
  });
});

describe('parseCdcMvx', () => {
  const row = (mvx: string, name: string, status = 'Active'): string => `${mvx}|${name}|a note|${status}|2017/11/16`;

  it('keeps active manufacturers, in code order', () => {
    expect(
      parseCdcMvx(
        [row('PMC', 'Sanofi Pasteur '), row('BRR', 'Barr Laboratories', 'Inactive'), row('MSD', 'Merck')].join('\r\n')
      )
    ).toEqual([
      { mvx: 'MSD', name: 'Merck' },
      { mvx: 'PMC', name: 'Sanofi Pasteur' },
    ]);
  });

  it('fails loudly when the download is not the file we expect', () => {
    expect(() => parseCdcMvx('PMC|Sanofi Pasteur')).toThrow('Row 1 has 2 fields, expected 5');
    expect(() => parseCdcMvx(row('msd', 'Merck'))).toThrow('Malformed MVX');
    expect(() => parseCdcMvx(row('MSD', ''))).toThrow('has no name');
    expect(() => parseCdcMvx([row('MSD', 'Merck'), row('MSD', 'Merck')].join('\r\n'))).toThrow('Duplicate MVX MSD');
    expect(() => parseCdcMvx(row('MSD', 'Merck', 'Inactive'))).toThrow('No active MVX manufacturers found');
  });
});

// The source files are CDC's downloads, committed byte for byte; sources.json records each one's SHA-256.
describe('CDC source files (run `npm run codes:vaccines:refresh` to replace them; never edit them)', () => {
  const manifest: Record<string, { url: string; bytes: number; sha256: string }> = JSON.parse(read('sources.json'));

  it('lists the two CDC downloads', () => {
    expect(Object.keys(manifest).sort()).toEqual(['cvx.txt', 'mvx.txt']);
    for (const source of Object.values(manifest)) {
      expect(source.url).toMatch(/^https:\/\/www2a\.cdc\.gov\/vaccines\/iis\/iisstandards\/downloads\//);
    }
  });

  it.each(Object.entries(manifest))('%s is the file that was downloaded', (file, source) => {
    const bytes = readFileSync(resolve(SOURCE_DIR, file));
    expect(bytes.length).toBe(source.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256);
  });
});

// The committed tables are generated from scripts/data/cdc-vaccines; this keeps them in step.
describe('generated vaccine code tables (run `npm run codes:vaccines` if these fail)', () => {
  const cvx = parseCdcCvx(read('cvx.txt'));

  it('CVX table matches the source', () => {
    expect(CVX_VACCINES).toEqual(cvx);
  });

  it('MVX table matches the source', () => {
    expect(MVX_MANUFACTURERS).toEqual(parseCdcMvx(read('mvx.txt')));
  });
});
