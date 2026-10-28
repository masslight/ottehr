import { Coding, Extension } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { CODE_SYSTEM_CPT_MODIFIER, EXTENSION_URL_CPT_MODIFIER } from '../helpers/rcm/constants';
import {
  extractCptCodeModifiersFromCoding,
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

describe('extractCptCodeModifiersFromCoding', () => {
  const modifierExtension = (codings: { code: string; display: string }[]): Extension => ({
    url: EXTENSION_URL_CPT_MODIFIER,
    valueCodeableConcept: {
      coding: codings.map((c) => ({ system: CODE_SYSTEM_CPT_MODIFIER, code: c.code, display: c.display })),
    },
  });

  it('returns modifiers from every modifier extension, not just the first', () => {
    // repeat orders write the '91' extension ahead of the test's own modifier extension
    const coding: Coding = {
      system: 'http://www.ama-assn.org/go/cpt',
      code: '87880',
      extension: [
        modifierExtension([{ code: '91', display: 'Repeat clinical test' }]),
        modifierExtension([{ code: '50', display: 'Bilateral Procedure' }]),
      ],
    };

    expect(extractCptCodeModifiersFromCoding(coding)).toEqual([
      { code: '91', display: 'Repeat clinical test' },
      { code: '50', display: 'Bilateral Procedure' },
    ]);
  });

  it('returns every modifier coding held by a single extension', () => {
    const coding: Coding = {
      system: 'http://www.ama-assn.org/go/cpt',
      code: '99213',
      extension: [
        modifierExtension([
          { code: '25', display: 'Significant E/M' },
          { code: '59', display: 'Distinct Procedural Service' },
        ]),
      ],
    };

    expect(extractCptCodeModifiersFromCoding(coding)).toEqual([
      { code: '25', display: 'Significant E/M' },
      { code: '59', display: 'Distinct Procedural Service' },
    ]);
  });

  it('returns an empty list when the coding has no modifier extension', () => {
    expect(extractCptCodeModifiersFromCoding({ code: '87880' })).toEqual([]);
    expect(
      extractCptCodeModifiersFromCoding({
        code: '87880',
        extension: [{ url: 'http://other-extension', valueString: 'x' }],
      })
    ).toEqual([]);
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
