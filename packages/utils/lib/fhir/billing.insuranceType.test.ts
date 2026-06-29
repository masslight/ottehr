import { Coverage } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { EXTENSION_CLAIM_INSURANCE_TYPE } from '../helpers/rcm/constants';
import { getCoverageInsuranceType, setCoverageInsuranceType } from './billing';
import { CANDID_PLAN_TYPE_SYSTEM } from './insurance';

const baseCoverage: Coverage = {
  resourceType: 'Coverage',
  status: 'active',
  beneficiary: {
    reference: 'Patient/p',
  },
  payor: [
    {
      reference: 'Organization/o',
    },
  ],
};

describe('coverage insurance type', () => {
  it('mirrors the code onto the extension and Coverage.type, without mutating the original', () => {
    const result = setCoverageInsuranceType(baseCoverage, '12');

    expect(result.extension).toEqual([
      {
        url: EXTENSION_CLAIM_INSURANCE_TYPE,
        valueString: '12',
      },
    ]);
    expect(result.type?.coding).toEqual([
      {
        system: CANDID_PLAN_TYPE_SYSTEM,
        code: '12',
      },
    ]);
    expect(baseCoverage.extension).toBeUndefined();
    expect(baseCoverage.type).toBeUndefined();
  });

  it('replaces the existing code and preserves unrelated extensions and type codings', () => {
    const coverage: Coverage = {
      ...baseCoverage,
      extension: [
        {
          url: 'https://example.com/other',
          valueString: 'keep',
        },
        {
          url: EXTENSION_CLAIM_INSURANCE_TYPE,
          valueString: 'HM',
        },
      ],
      type: {
        coding: [
          {
            system: 'https://example.com/other-type',
            code: 'keep',
          },
          {
            system: CANDID_PLAN_TYPE_SYSTEM,
            code: 'HM',
          },
        ],
      },
    };

    const result = setCoverageInsuranceType(coverage, 'MC');

    expect(result.extension).toEqual([
      {
        url: 'https://example.com/other',
        valueString: 'keep',
      },
      {
        url: EXTENSION_CLAIM_INSURANCE_TYPE,
        valueString: 'MC',
      },
    ]);
    expect(result.type?.coding).toEqual([
      {
        system: 'https://example.com/other-type',
        code: 'keep',
      },
      {
        system: CANDID_PLAN_TYPE_SYSTEM,
        code: 'MC',
      },
    ]);
  });

  it('reads the insurance type code back from the extension', () => {
    const result = setCoverageInsuranceType(baseCoverage, 'WC');

    expect(getCoverageInsuranceType(result)).toBe('WC');
  });

  it('returns undefined for a missing coverage or a coverage without the code', () => {
    expect(getCoverageInsuranceType(undefined)).toBeUndefined();
    expect(getCoverageInsuranceType(baseCoverage)).toBeUndefined();
  });
});
