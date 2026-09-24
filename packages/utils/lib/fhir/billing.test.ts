import { Coding } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { getCptBillableUnitsFromCoding } from './billing';
import { CPT_BILLABLE_UNITS_EXTENSION_URL } from './constants';

describe('getCptBillableUnitsFromCoding', () => {
  it('reads a positive unit count from the CPT coding extension', () => {
    const coding: Coding = {
      code: '13133',
      extension: [{ url: CPT_BILLABLE_UNITS_EXTENSION_URL, valueDecimal: 2 }],
    };

    expect(getCptBillableUnitsFromCoding(coding)).toBe(2);
  });

  it.each([0, -1, Number.NaN])('rejects an invalid unit count: %s', (value) => {
    const coding: Coding = {
      code: '13133',
      extension: [{ url: CPT_BILLABLE_UNITS_EXTENSION_URL, valueDecimal: value }],
    };

    expect(getCptBillableUnitsFromCoding(coding)).toBeUndefined();
  });
});
