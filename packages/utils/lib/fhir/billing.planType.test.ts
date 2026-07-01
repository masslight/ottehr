import { Claim, Coverage } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  EXTENSION_CLAIM_ASSIGNMENT_OR_PLAN_PARTICIPATION_CODE,
  EXTENSION_CLAIM_BENEFITS_ASSIGNMENT_CERTIFICATION_INDICATOR,
  EXTENSION_CLAIM_INSURANCE_TYPE,
  EXTENSION_CLAIM_PROVIDER_SIGNATURE_INDICATOR,
  EXTENSION_CLAIM_RELEASE_OF_INFORMATION_CODE,
} from '../helpers/rcm/constants';
import {
  clearClaimPlanType,
  getClaimPlanType,
  getDefaultClaimSubmissionExtensions,
  setClaimPlanType,
  setCoveragePlanType,
} from './billing';
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

const baseClaim: Claim = {
  resourceType: 'Claim',
  status: 'draft',
  type: {
    coding: [
      {
        code: 'professional',
      },
    ],
  },
  use: 'claim',
  created: '2026-01-01',
  patient: {
    reference: 'Patient/p',
  },
  provider: {
    display: 'Unknown',
  },
  priority: {
    coding: [
      {
        code: 'normal',
      },
    ],
  },
  insurance: [],
};

describe('coverage plan type', () => {
  it('writes the candid code to Coverage.type with no extension, leaving the original untouched', () => {
    const result = setCoveragePlanType(baseCoverage, '12');

    expect(result.type?.coding).toEqual([
      {
        system: CANDID_PLAN_TYPE_SYSTEM,
        code: '12',
      },
    ]);
    expect(result.extension).toBeUndefined();
    expect(baseCoverage.type).toBeUndefined();
  });

  it('replaces the existing candid code and preserves unrelated type codings', () => {
    const coverage: Coverage = {
      ...baseCoverage,
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
});

describe('claim plan type', () => {
  it('writes the candid code to the Claim extension and reads it back', () => {
    const claim = structuredClone(baseClaim);
    setClaimPlanType(claim, '12');

    expect(claim.extension).toEqual([
      {
        url: EXTENSION_CLAIM_INSURANCE_TYPE,
        valueString: '12',
      },
    ]);
    expect(getClaimPlanType(claim)).toBe('12');
  });

  it('replaces the existing code and preserves unrelated extensions', () => {
    const claim: Claim = {
      ...structuredClone(baseClaim),
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
    };

    setClaimPlanType(claim, 'MC');

    expect(claim.extension).toEqual([
      {
        url: 'https://example.com/other',
        valueString: 'keep',
      },
      {
        url: EXTENSION_CLAIM_INSURANCE_TYPE,
        valueString: 'MC',
      },
    ]);
  });

  it('returns undefined for a missing claim or a claim without the code', () => {
    expect(getClaimPlanType(undefined)).toBeUndefined();
    expect(getClaimPlanType(structuredClone(baseClaim))).toBeUndefined();
  });

  it('clears the plan type while leaving unrelated extensions intact', () => {
    const claim: Claim = {
      ...structuredClone(baseClaim),
      extension: [
        {
          url: 'https://example.com/other',
          valueString: 'keep',
        },
        {
          url: EXTENSION_CLAIM_INSURANCE_TYPE,
          valueString: '12',
        },
      ],
    };

    clearClaimPlanType(claim);

    expect(claim.extension).toEqual([
      {
        url: 'https://example.com/other',
        valueString: 'keep',
      },
    ]);
  });

  it('drops the extension array entirely when only the plan type was present', () => {
    const claim = structuredClone(baseClaim);
    setClaimPlanType(claim, '12');

    clearClaimPlanType(claim);

    expect(claim.extension).toBeUndefined();
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

  it('layers plan type on top of the defaults without dropping them', () => {
    const claim: Claim = { ...structuredClone(baseClaim), extension: getDefaultClaimSubmissionExtensions() };

    setClaimPlanType(claim, '12');

    expect(claim.extension).toEqual([
      ...getDefaultClaimSubmissionExtensions(),
      { url: EXTENSION_CLAIM_INSURANCE_TYPE, valueString: '12' },
    ]);
    expect(getClaimPlanType(claim)).toBe('12');
  });
});
