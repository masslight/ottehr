import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CVX_VACCINES } from './cvx-vaccines.generated';
import { MVX_MANUFACTURERS } from './mvx-manufacturers.generated';
import { NDC_VACCINE_PRODUCTS } from './ndc-vaccines.generated';
import { CVX_NOT_OFFERED, ndc11Candidates, parseCdcNdcLookup, parseCvxPsv, parseMvxPsv } from './vaccine-codes';
import { findNdcVaccineProduct, getCvxVaccine, getMvxManufacturer } from './vaccine-lookup';

// scripts/data/cdc-vaccines at the repo root, relative to this file (packages/utils/lib/types/data/immunization/).
const SOURCE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../../scripts/data/cdc-vaccines');
const read = (file: string): string => readFileSync(resolve(SOURCE_DIR, file), 'utf-8');
// Must match scripts/generate-vaccine-code-lists.ts
const NDC_KEEP_ENDED_SINCE = '2024-01-01';

describe('parseCvxPsv', () => {
  it('reads each vaccine in name order and leaves out the codes a practice would not stock', () => {
    const vaccines = parseCvxPsv(
      [
        '# comment',
        '115|Tdap|tetanus, diphtheria, pertussis|',
        '03|MMR|measles, mumps and rubella|note',
        '318|Anthrax PEP|Anthrax|stockpile',
      ].join('\n')
    );
    expect(vaccines).toEqual([
      { cvx: '03', name: 'MMR', fullName: 'measles, mumps and rubella', notes: 'note' },
      { cvx: '115', name: 'Tdap', fullName: 'tetanus, diphtheria, pertussis' },
    ]);
    expect(CVX_NOT_OFFERED.has('318')).toBe(true);
  });

  it('rejects malformed rows', () => {
    expect(() => parseCvxPsv('ABC|x|y|')).toThrow('Malformed CVX');
    expect(() => parseCvxPsv('03||y|')).toThrow('has no name');
    expect(() => parseCvxPsv('03|MMR|y|\n03|MMR|y|')).toThrow('Duplicate CVX 03');
  });
});

describe('parseMvxPsv', () => {
  it('reads manufacturers in code order', () => {
    expect(parseMvxPsv('PMC|Sanofi Pasteur\nMSD|Merck')).toEqual([
      { mvx: 'MSD', name: 'Merck' },
      { mvx: 'PMC', name: 'Sanofi Pasteur' },
    ]);
    expect(() => parseMvxPsv('msd|Merck')).toThrow('Malformed MVX');
  });
});

describe('parseCdcNdcLookup', () => {
  const header =
    '"SequenceNumber"|"Sale NDC11"|"Sale Proprietary Name"|"Sale Labeler"|"Start Date"|"End Date"|"Sale GTIN"|"Sale Last Update"|"Use NDC11"|"No use NDC"|"Use GTIN"|"Use Last Update"|"CVX Code"|"CVX Description"|"MVX Code"';
  const row = (sale: string, use: string, cvx: string, end = ''): string =>
    `"1"|"${sale}"|"Brand"|"Labeler"|"01/01/2020"|"${end}"|""|""|"${use}"|"False"|""|""|"${cvx}"|"desc"|"MSD"`;

  it('keeps the offered vaccines, drops long-ended packages and duplicate rows, and ignores the BOM', () => {
    const text = [
      '﻿' + header,
      row('00006-4681-00', '00006-4681-01', '03'),
      row('00006-4681-00', '00006-4681-01', '03'),
      row('00006-4047-20', '00006-4047-01', '116', '12/31/2022'),
      row('00006-9999-00', '00006-9999-01', '999'),
    ].join('\r\n');
    expect(parseCdcNdcLookup(text, new Set(['03', '116']), '2024-01-01')).toEqual([
      { saleNdc: '00006-4681-00', useNdc: '00006-4681-01', name: 'Brand', labeler: 'Labeler', cvx: '03', mvx: 'MSD' },
    ]);
  });

  it('fails loudly when the download changed shape', () => {
    expect(() => parseCdcNdcLookup('"Sale NDC11"|"CVX Code"\n"x"|"03"', new Set(['03']), '2024-01-01')).toThrow(
      'Missing "Sale Proprietary Name" column'
    );
  });
});

describe('ndc11Candidates', () => {
  it('spells every usual NDC form as 5-4-2', () => {
    expect(ndc11Candidates('00006-4681-00')).toEqual(['00006-4681-00']);
    expect(ndc11Candidates('00006468100')).toEqual(['00006-4681-00']);
    expect(ndc11Candidates('0006-4681-00')).toEqual(['00006-4681-00']);
    expect(ndc11Candidates('58160-823-11')).toEqual(['58160-0823-11']);
    expect(ndc11Candidates('49281-0400-5')).toEqual(['49281-0400-05']);
    expect(ndc11Candidates('5816082311')).toEqual(['05816-0823-11', '58160-0823-11', '58160-8231-01']);
    expect(ndc11Candidates('not an ndc')).toEqual([]);
  });
});

describe('lookups over the generated tables', () => {
  it('finds a vaccine, a manufacturer and a box', () => {
    expect(getCvxVaccine('03')?.name).toBe('MMR');
    expect(getMvxManufacturer('MSD')?.name).toMatch(/Merck/);
    // M-M-R II unit of sale and unit of use, in CDC and 10-digit spellings
    expect(findNdcVaccineProduct('00006-4681-00')).toMatchObject({ cvx: '03', mvx: 'MSD' });
    expect(findNdcVaccineProduct('0006-4681-01')).toMatchObject({ cvx: '03', mvx: 'MSD' });
    expect(findNdcVaccineProduct('99999-9999-99')).toBeUndefined();
  });
});

// The committed tables are generated from scripts/data/cdc-vaccines; this keeps them in step.
describe('generated vaccine code tables (run `npm run codes:vaccines` if these fail)', () => {
  const cvx = parseCvxPsv(read('cvx-active.psv'));

  it('CVX table matches the source', () => {
    expect(CVX_VACCINES).toEqual(cvx);
  });

  it('MVX table matches the source', () => {
    expect(MVX_MANUFACTURERS).toEqual(parseMvxPsv(read('mvx-active.psv')));
  });

  it('NDC table matches the source', () => {
    expect(NDC_VACCINE_PRODUCTS).toEqual(
      parseCdcNdcLookup(read('cdc-ndc-lookup.txt'), new Set(cvx.map((vaccine) => vaccine.cvx)), NDC_KEEP_ENDED_SINCE)
    );
  });
});
