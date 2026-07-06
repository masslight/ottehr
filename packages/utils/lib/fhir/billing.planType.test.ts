import { Coverage } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  EXTENSION_CLAIM_ASSIGNMENT_OR_PLAN_PARTICIPATION_CODE,
  EXTENSION_CLAIM_BENEFITS_ASSIGNMENT_CERTIFICATION_INDICATOR,
  EXTENSION_CLAIM_INSURANCE_TYPE,
  EXTENSION_CLAIM_PROVIDER_SIGNATURE_INDICATOR,
  EXTENSION_CLAIM_RELEASE_OF_INFORMATION_CODE,
} from '../helpers/rcm/constants';
import { getCoveragePlanType, getDefaultClaimSubmissionExtensions, setCoveragePlanType } from './billing';
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

describe('coverage plan type', () => {
  it('mirrors the code onto the extension and Coverage.type, without mutating the original', () => {
    const result = setCoveragePlanType(baseCoverage, '12');

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

    const result = setCoveragePlanType(coverage, 'MC');

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

  it('reads the plan type code back from the extension', () => {
    const result = setCoveragePlanType(baseCoverage, 'WC');

    expect(getCoveragePlanType(result)).toBe('WC');
  });

  it('returns undefined for a missing coverage or a coverage without the code', () => {
    expect(getCoveragePlanType(undefined)).toBeUndefined();
    expect(getCoveragePlanType(baseCoverage)).toBeUndefined();
  });

  it('ignores a coding code that is not in the candid value set', () => {
    const coverage: Coverage = {
      ...baseCoverage,
      type: {
        coding: [
          {
            system: CANDID_PLAN_TYPE_SYSTEM,
            code: 'BOGUS',
          },
        ],
      },
    };

    expect(getCoveragePlanType(coverage)).toBeUndefined();
  });

  it('treats an empty or invalid extension value as missing and falls back to a valid coding', () => {
    const coverage: Coverage = {
      ...baseCoverage,
      extension: [
        {
          url: EXTENSION_CLAIM_INSURANCE_TYPE,
          valueString: '',
        },
      ],
      type: {
        coding: [
          {
            system: CANDID_PLAN_TYPE_SYSTEM,
            code: '12',
          },
        ],
      },
    };

    expect(getCoveragePlanType(coverage)).toBe('12');
  });
});

describe('default claim submission extensions', () => {
  it('produces the constant RCM attributes the Submit Claim endpoint requires', () => {
    expect(getDefaultClaimSubmissionExtensions()).toEqual([
      { url: EXTENSION_CLAIM_PROVIDER_SIGNATURE_INDICATOR, valueBoolean: true },
      { url: EXTENSION_CLAIM_ASSIGNMENT_OR_PLAN_PARTICIPATION_CODE, valueString: 'A' },
      { url: EXTENSION_CLAIM_BENEFITS_ASSIGNMENT_CERTIFICATION_INDICATOR, valueString: 'Y' },
      { url: EXTENSION_CLAIM_RELEASE_OF_INFORMATION_CODE, valueString: 'Y' },
    ]);
  });

  it('returns a fresh array each call so mutating one claim cannot leak into another', () => {
    const first = getDefaultClaimSubmissionExtensions();
    const second = getDefaultClaimSubmissionExtensions();
    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
  });
});
