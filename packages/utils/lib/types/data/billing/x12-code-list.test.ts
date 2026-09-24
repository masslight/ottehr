import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CARC_OPTIONS, carcDescription } from './carc';
import { CARC_CODE_LIST } from './carc-codes.generated';
import { RARC_OPTIONS, rarcDescription } from './rarc';
import { RARC_CODE_LIST } from './rarc-codes.generated';
import { parseX12CodeList } from './x12-code-list';

// scripts/data/x12/ at the repo root, relative to this file (packages/utils/lib/types/data/billing/).
const SOURCE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../../scripts/data/x12');
const readSource = (file: string): string => readFileSync(resolve(SOURCE_DIR, file), 'utf-8');

describe('parseX12CodeList', () => {
  it('reads codes, joins continuation paragraphs and drops revision metadata', () => {
    const text = [
      'M1 X-ray not taken within the past 12 months.',
      'Start: 01/01/1997',
      'M26 The information furnished does not substantiate the need.',
      '',
      'The requirements for refund are in 1824(I).',
      'Start: 01/01/1997 | Last Modified: 11/05/2007',
      'Notes: (Modified 10/1/02)',
      'MA01 Alert: You may appeal.',
      'Start: 01/01/1997',
    ].join('\n');

    expect(parseX12CodeList(text)).toEqual([
      { code: 'M1', description: 'X-ray not taken within the past 12 months.' },
      {
        code: 'M26',
        description:
          'The information furnished does not substantiate the need.\n\nThe requirements for refund are in 1824(I).',
      },
      { code: 'MA01', description: 'Alert: You may appeal.' },
    ]);
  });

  it('cuts payer-facing Usage guidance when asked', () => {
    const text =
      '4 The procedure code is inconsistent with the modifier used. Usage: Refer to the 835 REF.\nStart: 01/01/1995';
    expect(parseX12CodeList(text, { dropUsage: true })).toEqual([
      { code: '4', description: 'The procedure code is inconsistent with the modifier used.' },
    ]);
    expect(parseX12CodeList(text)[0].description).toContain('Usage:');
  });

  it('rejects malformed lists', () => {
    expect(() => parseX12CodeList('Start: 01/01/1995')).toThrow(/Unexpected "Start:"/);
    expect(() => parseX12CodeList('not a code line')).toThrow(/Expected "<code> <description>"/);
    expect(() => parseX12CodeList('1 Deductible Amount')).toThrow(/no "Start:" line/);
    expect(() => parseX12CodeList('1 A\nStart: x\n1 B\nStart: x')).toThrow(/Duplicate code 1/);
  });
});

// The committed tables are generated from scripts/data/x12/; this keeps them in step. If a test here
// fails you replaced a source list without regenerating the tables.
describe('generated code tables (run `npm run codes:x12` if these fail)', () => {
  it('CARC table matches scripts/data/x12/carc-list.txt', () => {
    expect(CARC_CODE_LIST).toEqual(parseX12CodeList(readSource('carc-list.txt'), { dropUsage: true }));
    expect(CARC_CODE_LIST).toHaveLength(297);
  });

  it('RARC table matches scripts/data/x12/rarc-list.txt', () => {
    expect(RARC_CODE_LIST).toEqual(parseX12CodeList(readSource('rarc-list.txt')));
    expect(RARC_CODE_LIST).toHaveLength(1137);
  });
});

describe('code lookups', () => {
  it('describes current CARCs without their Usage guidance', () => {
    expect(carcDescription('45')).toBe(
      'Charge exceeds fee schedule/maximum allowable or contracted/legislated fee arrangement.'
    );
    expect(carcDescription('P32')).toBe('Payment adjusted due to Apportionment.');
  });

  it('keeps describing deactivated CARCs that older ERAs carry, without offering them', () => {
    expect(carcDescription('15')).toMatch(/authorization number is missing/);
    expect(CARC_OPTIONS.some((option) => option.code === '15')).toBe(false);
  });

  it('describes RARCs, including multi-paragraph ones', () => {
    expect(rarcDescription('M1')).toBe(
      'X-ray not taken within the past 12 months or near enough to the start of treatment.'
    );
    expect(rarcDescription('N355')?.split('\n\n')).toHaveLength(5);
    expect(rarcDescription('ZZ9')).toBeUndefined();
    expect(RARC_OPTIONS[0].code).toBe('M1');
  });
});
