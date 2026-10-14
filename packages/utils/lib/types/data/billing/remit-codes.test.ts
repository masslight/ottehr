import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CARC_OPTIONS, carcDescription } from './carc';
import { CARC_CODE_LIST } from './carc-codes.generated';
import { RARC_OPTIONS, rarcDescription } from './rarc';
import { RARC_CODE_LIST } from './rarc-codes.generated';
import { parseRemitCodeCsv } from './remit-codes';

// scripts/data/remit-codes.csv at the repo root, relative to this file (packages/utils/lib/types/data/billing/).
const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../../scripts/data/remit-codes.csv');

describe('parseRemitCodeCsv', () => {
  it('reads each code with its label, in code order, whatever other columns the file has', () => {
    const csv = [
      'type,code,label,next_step',
      'RARC,N2,Second remark,Call the payer',
      'CARC,B1,Lettered code,',
      'RARC,MA01,"Quoted, with a comma",',
      'CARC,10,Ten,',
      'RARC,M2,"Says ""appeal""",',
      '',
      'CARC,2,Two,',
      'RARC,M10,Tenth M code,',
    ].join('\r\n');

    expect(parseRemitCodeCsv(csv)).toEqual({
      carc: [
        { code: '2', description: 'Two' },
        { code: '10', description: 'Ten' },
        { code: 'B1', description: 'Lettered code' },
      ],
      rarc: [
        { code: 'M2', description: 'Says "appeal"' },
        { code: 'M10', description: 'Tenth M code' },
        { code: 'MA01', description: 'Quoted, with a comma' },
        { code: 'N2', description: 'Second remark' },
      ],
    });
  });

  it('rejects malformed rows', () => {
    const csv = (rows: string): string => `type,code,label\n${rows}`;
    expect(() => parseRemitCodeCsv('type,code\nCARC,1')).toThrow('Missing "label" column');
    expect(() => parseRemitCodeCsv(csv('CAS,1,One'))).toThrow('Unknown type "CAS" on row 2');
    expect(() => parseRemitCodeCsv(csv('RARC,X1,One'))).toThrow('Malformed RARC "X1" on row 2');
    expect(() => parseRemitCodeCsv(csv('CARC,1, '))).toThrow('CARC 1 has no label on row 2');
    expect(() => parseRemitCodeCsv(csv('CARC,1,One\nCARC,1,Again'))).toThrow('Duplicate CARC 1 on row 3');
    expect(() => parseRemitCodeCsv(csv('CARC,1,"One'))).toThrow('Unterminated quoted field');
  });
});

// The committed tables are generated from scripts/data/remit-codes.csv; this keeps them in step. If a
// test here fails, the CSV changed without the tables being regenerated.
describe('generated code tables (run `npm run codes:remit` if these fail)', () => {
  const lists = parseRemitCodeCsv(readFileSync(SOURCE, 'utf-8'));

  it('CARC table matches the CSV', () => {
    expect(CARC_CODE_LIST).toEqual(lists.carc);
    expect(CARC_CODE_LIST).toHaveLength(403);
  });

  it('RARC table matches the CSV', () => {
    expect(RARC_CODE_LIST).toEqual(lists.rarc);
    expect(RARC_CODE_LIST).toHaveLength(1187);
  });
});

describe('code lookups', () => {
  it('offers and describes every CARC, older ones included', () => {
    expect(CARC_OPTIONS).toBe(CARC_CODE_LIST);
    expect(CARC_OPTIONS.slice(0, 3).map(({ code }) => code)).toEqual(['1', '2', '3']);
    expect(carcDescription('45')).toBe("Paid less: billed amount is above the payer's allowed rate");
    expect(carcDescription('15')).toBe('Denied: prior-approval number absent, wrong, or for something else');
    expect(carcDescription('ZZ9')).toBeUndefined();
  });

  it('offers and describes every RARC', () => {
    expect(RARC_OPTIONS[0].code).toBe('M1');
    expect(rarcDescription('MA18')).toBe("Info: claim was also sent to the patient's supplemental insurer");
    expect(rarcDescription('ZZ9')).toBeUndefined();
  });
});
