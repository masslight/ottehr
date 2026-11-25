import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findCvxVaccine } from './cvx-vaccine-lookup';
import { CVX_VACCINES } from './cvx-vaccines.generated';
import { MVX_MANUFACTURERS } from './mvx-manufacturers.generated';
import { parseCdcCvx, parseCdcMvx } from './vaccine-codes';

const SOURCE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../../scripts/data/cdc-vaccines');
const readSource = (file: string): Buffer => readFileSync(resolve(SOURCE_DIR, file));

const cvxRow = (cvx: string, name: string, status = 'Active', nonVaccine = 'False', notes = ''): string =>
  `${cvx.padEnd(10)}|${name}|${name}, full name|${notes}|${status}|${nonVaccine}|2024/01/31`;

describe('parseCdcCvx', () => {
  it('keeps active vaccines a practice would stock, in name order', () => {
    const text = [
      `\uFEFF${cvxRow('115', 'Tdap', 'Active', 'False', 'booster')}`,
      cvxRow('03', 'MMR'),
      cvxRow('20', 'DTaP'),
      cvxRow('138', 'Td (adult) not adsorbed', 'Inactive'),
      cvxRow('999', 'unknown vaccine or immune globulin', 'Inactive'),
      cvxRow('86', 'IG', 'Active', 'True'),
      cvxRow('160', 'Influenza A monovalent (H5N1), ADJUVANTED-2013'),
      '',
    ].join('\r\n');

    expect(parseCdcCvx(text)).toEqual([
      { cvx: '20', name: 'DTaP', fullName: 'DTaP, full name' },
      { cvx: '03', name: 'MMR', fullName: 'MMR, full name' },
      { cvx: '115', name: 'Tdap', fullName: 'Tdap, full name', notes: 'booster' },
    ]);
  });

  it('rejects a file that is not the CDC CVX layout', () => {
    expect(() => parseCdcCvx('<html>Service unavailable</html>')).toThrow('1 fields on row 1, expected 7');
    expect(() => parseCdcCvx(cvxRow('1x', 'Bad'))).toThrow('Malformed CVX "1x" on row 1');
    expect(() => parseCdcCvx(cvxRow('03', 'MMR', 'Active', 'maybe'))).toThrow('CVX 03 has an unexpected status');
    expect(() => parseCdcCvx([cvxRow('03', 'MMR'), '', cvxRow('03', 'MMR')].join('\n'))).toThrow(
      'Duplicate CVX 03 on row 3'
    );
    expect(() => parseCdcCvx(cvxRow('138', 'Td', 'Inactive'))).toThrow('No active CVX vaccines found');
  });
});

describe('parseCdcMvx', () => {
  it('keeps active manufacturers, in code order', () => {
    const text = [
      'SKB|GlaxoSmithKline|includes SmithKline Beecham|Active|2010/05/28',
      'AB|Abbott Laboratories||Inactive|2017/11/16',
      'MSD|Merck and Co., Inc.||Active|2010/05/28',
    ].join('\r\n');

    expect(parseCdcMvx(text)).toEqual([
      { mvx: 'MSD', name: 'Merck and Co., Inc.' },
      { mvx: 'SKB', name: 'GlaxoSmithKline' },
    ]);
  });

  it('rejects a file that is not the CDC MVX layout', () => {
    expect(() => parseCdcMvx('SKB|GlaxoSmithKline|Active|2010/05/28')).toThrow('4 fields on row 1, expected 5');
    expect(() => parseCdcMvx('skb|GlaxoSmithKline||Active|2010/05/28')).toThrow('Malformed MVX "skb" on row 1');
    expect(() => parseCdcMvx('SKB|GlaxoSmithKline||Active|28.05.2010')).toThrow('MVX SKB has an unexpected status');
  });
});

describe('CDC source files (run `npm run codes:vaccines` if these fail)', () => {
  const manifest: Record<string, { bytes: number; sha256: string }> = JSON.parse(
    readSource('sources.json').toString('utf-8')
  );

  it.each(['cvx.txt', 'mvx.txt'])('%s is the download sources.json recorded', (file) => {
    const body = readSource(file);
    expect({ bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') }).toEqual({
      bytes: manifest[file].bytes,
      sha256: manifest[file].sha256,
    });
  });

  it('the CVX table matches cvx.txt', () => {
    expect(CVX_VACCINES).toEqual(parseCdcCvx(readSource('cvx.txt').toString('utf-8')));
  });

  it('the MVX table matches mvx.txt', () => {
    expect(MVX_MANUFACTURERS).toEqual(parseCdcMvx(readSource('mvx.txt').toString('utf-8')));
  });
});

describe('findCvxVaccine', () => {
  it('finds a vaccine in the list by its CVX code', () => {
    expect(findCvxVaccine('115')?.name).toBe('Tdap');
    expect(findCvxVaccine('138')).toBeUndefined();
    expect(findCvxVaccine('3a1c-medication-id')).toBeUndefined();
    expect(findCvxVaccine(undefined)).toBeUndefined();
  });
});
