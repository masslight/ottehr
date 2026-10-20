import { Coding } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  getCptBillableUnitsFromCoding,
  INSURANCE_TYPE_CODE_TO_CANDID_CODE,
  mapInsuranceTypeCodeToCandidCode,
} from './billing';
import { CPT_BILLABLE_UNITS_EXTENSION_URL } from './constants';
import { INSURANCE_CANDID_PLAN_TYPE_CODES } from './insurance';

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

describe('mapInsuranceTypeCodeToCandidCode', () => {
  it.each([
    ['PR', '12'], // Preferred Provider Organization -> PPO
    ['PS', '13'], // Point of Service -> POS
    ['EP', '14'], // Exclusive Provider Organization -> EPO, NOT PPO
    ['PP', '09'], // Personal payment (cash, no insurance) -> Self Pay
    ['HM', 'HM'],
    ['MC', 'MC'],
  ])('maps X12 insurance type %s to candid code %s', (insuranceTypeCode, expected) => {
    expect(mapInsuranceTypeCodeToCandidCode(insuranceTypeCode)).toBe(expected);
  });

  it.each(['pr', ' PR ', 'Pr'])('normalizes the code before lookup: %s', (insuranceTypeCode) => {
    expect(mapInsuranceTypeCodeToCandidCode(insuranceTypeCode)).toBe('12');
  });

  it.each([undefined, '', 'NOT-A-CODE'])('returns undefined for %s', (insuranceTypeCode) => {
    expect(mapInsuranceTypeCodeToCandidCode(insuranceTypeCode)).toBeUndefined();
  });

  it('only maps to codes the insurance type dropdown offers', () => {
    const unknownTargets = Object.entries(INSURANCE_TYPE_CODE_TO_CANDID_CODE).filter(
      ([, candidCode]) => !INSURANCE_CANDID_PLAN_TYPE_CODES.includes(candidCode)
    );

    expect(unknownTargets).toEqual([]);
  });
});
