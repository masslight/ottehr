import { BillingChargeItemDefinitionProcedureCode } from 'utils';
import { describe, expect, it } from 'vitest';
import { computeDelta, parseProcedureCodeCsv } from '../../src/utils/procedureCodeCsv';

describe('parseProcedureCodeCsv', () => {
  it('parses the template format, including quoted and multiline descriptions', () => {
    const csv = [
      'Procedure Code,Description,Modifier,Amount',
      '99213,"Office visit, extended",25,"$1,234.50"',
      '99214,"Line one\nline two",,150.00',
    ].join('\n');

    const result = parseProcedureCodeCsv(csv);

    expect(result).toEqual({
      ok: true,
      codes: [
        { code: '99213', description: 'Office visit, extended', modifier: '25', amount: 1234.5 },
        { code: '99214', description: 'Line one\nline two', modifier: undefined, amount: 150 },
      ],
      skippedRows: [],
      hasDescriptions: true,
    });
  });

  it('matches header names fuzzily and reports when there is no description column', () => {
    const result = parseProcedureCodeCsv('cpt,mod,price\n99213,25,150');

    expect(result).toMatchObject({
      ok: true,
      codes: [{ code: '99213', modifier: '25', amount: 150 }],
      hasDescriptions: false,
    });
  });

  it('skips invalid rows and keeps the last of duplicate code+modifier rows', () => {
    const csv = ['Procedure Code,Amount', ',50.00', '99999,12abc', '99213,-5', '99213,100', '99213,111'].join('\n');

    const result = parseProcedureCodeCsv(csv);

    expect(result).toEqual({
      ok: true,
      codes: [{ code: '99213', description: undefined, modifier: undefined, amount: 111 }],
      skippedRows: ['Row 2: invalid code or amount', 'Row 3: invalid code or amount', 'Row 4: invalid code or amount'],
      hasDescriptions: false,
    });
  });

  it('rejects files without usable content', () => {
    expect(parseProcedureCodeCsv('Procedure Code,Amount')).toEqual({
      ok: false,
      error: 'CSV file must have a header row and at least one data row.',
    });
    expect(parseProcedureCodeCsv('foo,bar\n1,2')).toEqual({
      ok: false,
      error: 'CSV must have "Procedure Code" and "Amount" columns.',
    });
    expect(parseProcedureCodeCsv('Procedure Code,Amount\n,not-a-number')).toEqual({
      ok: false,
      error: 'No valid rows found in the CSV file.',
    });
  });
});

describe('computeDelta', () => {
  const current: BillingChargeItemDefinitionProcedureCode[] = [
    { code: '99213', description: 'Visit A', amount: 100 },
    { code: '99214', description: 'Visit B', modifier: '25', amount: 200 },
    { code: '99215', description: 'Visit C', amount: 300 },
  ];

  it('classifies added, changed, removed and unchanged rows by code+modifier', () => {
    const uploaded: BillingChargeItemDefinitionProcedureCode[] = [
      { code: '99213', description: 'Visit A', amount: 150 },
      { code: '99214', description: 'Visit B', modifier: '25', amount: 200 },
      { code: '90000', description: 'New', amount: 50 },
    ];

    const delta = computeDelta(current, uploaded, true);

    expect(delta.rows.map((r) => `${r.status}:${r.code.code}`)).toEqual([
      'changed:99213',
      'added:90000',
      'removed:99215',
    ]);
    expect(delta.rows[0].previousAmount).toBe(100);
    expect(delta.unchangedCount).toBe(1);
  });

  it('treats a cleared description as a change only when the CSV has a description column', () => {
    const uploaded: BillingChargeItemDefinitionProcedureCode[] = [{ code: '99213', amount: 100 }];

    expect(computeDelta([current[0]], uploaded, true).rows.map((r) => r.status)).toEqual(['changed']);
    expect(computeDelta([current[0]], uploaded, false).unchangedCount).toBe(1);
  });
});
