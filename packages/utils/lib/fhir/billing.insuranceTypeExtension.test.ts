import { Coverage } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { EXTENSION_CLAIM_INSURANCE_TYPE } from '../helpers/rcm/constants';
import { getCoverageInsuranceTypeExtension, setCoverageInsuranceTypeExtension } from './billing';

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

describe('coverage insurance-type extension', () => {
  it('sets the extension on a coverage without one, without mutating the original', () => {
    const result = setCoverageInsuranceTypeExtension(baseCoverage, '12');

    expect(result.extension).toEqual([
      {
        url: EXTENSION_CLAIM_INSURANCE_TYPE,
        valueString: '12',
      },
    ]);
    expect(baseCoverage.extension).toBeUndefined();
  });

  it('replaces an existing insurance-type extension and preserves unrelated extensions', () => {
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
    };

    const result = setCoverageInsuranceTypeExtension(coverage, 'MC');

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
  });

  it('reads the insurance-type code back', () => {
    const result = setCoverageInsuranceTypeExtension(baseCoverage, 'WC');

    expect(getCoverageInsuranceTypeExtension(result)).toBe('WC');
  });

  it('returns undefined for a missing coverage or a coverage without the extension', () => {
    expect(getCoverageInsuranceTypeExtension(undefined)).toBeUndefined();
    expect(getCoverageInsuranceTypeExtension(baseCoverage)).toBeUndefined();
  });
});
