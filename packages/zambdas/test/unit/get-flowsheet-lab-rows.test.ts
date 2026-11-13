import { FlowsheetLabResult } from 'utils/lib/types/api/flowsheets.types';
import { describe, expect, test } from 'vitest';
import { LabRow, labRowFor } from '../../src/ehr/get-flowsheet/columns';
import { LAB_ROW_LOINC_CODES } from '../../src/ehr/get-flowsheet/lab-loinc-codes.generated';
import { LAB_ROW_RULES } from '../../src/ehr/get-flowsheet/lab-row-rules';

// The generated code lists: every row has codes, and the rules keep the measures the lab sends under any unit or
// method (the newborn rows also in a heel-stick sample) while leaving out other specimens, antibodies, ratios and
// deprecated codes.
describe('LAB_ROW_LOINC_CODES', () => {
  test('every lab row rule has codes, and nothing else does', () => {
    expect(Object.keys(LAB_ROW_LOINC_CODES).sort()).toEqual(Object.keys(LAB_ROW_RULES).sort());
    Object.values(LAB_ROW_LOINC_CODES).forEach((codes) => expect(codes.length).toBeGreaterThan(0));
  });

  test.each([
    ['tsh', ['3016-3', '11579-0', '11580-8', '27975-2', '14297-6']],
    ['freeT4', ['3024-7', '14920-3', '6892-4']],
    ['totalT4', ['3026-2']],
    ['freeT3', ['3051-0']],
    ['totalT3', ['3053-6']],
    ['tpoAntibodies', ['8099-4', '32042-4']],
    ['newbornTotalBilirubin', ['1975-2', '14631-6', '42719-5', '59828-4', '97770-2']],
    ['newbornDirectBilirubin', ['1968-7', '29760-6', '15152-2']],
    ['transcutaneousBilirubin', ['58941-6', '72898-0']],
  ])('%s carries the codes of its measure in every unit and method', (row, codes) => {
    codes.forEach((code) => expect(LAB_ROW_LOINC_CODES[row]).toContain(code));
  });

  test('other specimens, antibodies, ratios, timed samples and deprecated codes are on no row', () => {
    const all = Object.values(LAB_ROW_LOINC_CODES).flat();
    [
      '55462-6', // Deprecated Thyrotropin in Serum or Plasma
      '5385-0', // Thyrotropin receptor Ab in Serum
      '3015-5', // Thyrotropin in Blood
      '14999-7', // Thyrotropin --baseline
      '5770-3', // Bilirubin in Urine
      '48624-1', // Bilirubin.total in Cord blood
      '48623-3', // Bilirubin.direct in Cord blood
      '1971-1', // Bilirubin.indirect
      '3017-1', // Thyrotropin binding inhibitory immunoglobulins
    ].forEach((code) => expect(all).not.toContain(code));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('labRowFor', () => {
  const rows: LabRow[] = [
    { key: 'freeT4', analyte: /free t4|thyroxine.*free/i },
    { key: 'totalT4', analyte: /thyroxine/i, exclude: /free/i },
  ];
  const lab = (analyte: string, loincCodes: string[]): FlowsheetLabResult => ({
    analyte,
    loincCodes,
    value: 1,
    valueText: '1',
    unit: '',
    referenceRange: '',
    interpretation: '',
    source: 'external',
  });

  test('a coded result lands by code alone, whatever its name says', () => {
    expect(labRowFor(rows, lab('Thyroxine (T4)', ['14920-3']))).toBe('freeT4');
    expect(labRowFor(rows, lab('Free T4', ['3026-2']))).toBe('totalT4');
    expect(labRowFor(rows, lab('Free T4', ['99999-9']))).toBeUndefined();
  });

  test('an uncoded result lands by name, first row whose pattern fits and whose exclusion does not', () => {
    expect(labRowFor(rows, lab('Thyroxine (T4), free', []))).toBe('freeT4');
    expect(labRowFor(rows, lab('Thyroxine (T4)', []))).toBe('totalT4');
    expect(labRowFor(rows, lab('TSH', []))).toBeUndefined();
  });
});
