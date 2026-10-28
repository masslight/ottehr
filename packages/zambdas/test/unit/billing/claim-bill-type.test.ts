import { Claim, Extension } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  EXTENSION_CLAIM_FACILITY_TYPE_CODE,
  EXTENSION_CLAIM_FREQUENCY_CODE,
  getClaimBillType,
} from '../../../src/billing/shared';

const claimWith = (extension: Extension[]): Claim =>
  ({
    resourceType: 'Claim',
    extension,
  }) as Claim;

const facilityType: Extension = {
  url: EXTENSION_CLAIM_FACILITY_TYPE_CODE,
  valueString: '13',
};

describe('getClaimBillType', () => {
  it('joins the facility type and frequency codes', () => {
    const claim = claimWith([
      facilityType,
      {
        url: EXTENSION_CLAIM_FREQUENCY_CODE,
        valueString: '7',
      },
    ]);
    expect(getClaimBillType(claim)).toBe('0137');
  });

  it('defaults a missing frequency code to 1', () => {
    expect(getClaimBillType(claimWith([facilityType]))).toBe('0131');
  });

  it('defaults an empty frequency code to 1', () => {
    const claim = claimWith([
      facilityType,
      {
        url: EXTENSION_CLAIM_FREQUENCY_CODE,
        valueString: '',
      },
    ]);
    expect(getClaimBillType(claim)).toBe('0131');
  });

  it('returns an empty bill type without a facility type code', () => {
    expect(getClaimBillType(claimWith([]))).toBe('');
  });
});
