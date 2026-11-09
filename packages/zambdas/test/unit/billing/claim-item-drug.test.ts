import { ClaimItem } from 'fhir/r4b';
import { CODE_SYSTEM_NDC } from 'utils/lib/helpers/rcm/constants';
import { describe, expect, it } from 'vitest';
import { buildClaimItemDrugDetail, readClaimItemDrug } from '../../../src/billing/shared';

const lineItem = (detail?: ClaimItem['detail']): ClaimItem => ({
  sequence: 1,
  productOrService: { coding: [{ code: 'J1100' }] },
  detail,
});

describe('buildClaimItemDrugDetail', () => {
  it('stores the NDC (as 11 plain digits), quantity, and unit as a single item.detail entry', () => {
    expect(buildClaimItemDrugDetail({ ndc: '00409-4888-02', quantity: 2.5, units: 'ML' })).toEqual([
      {
        sequence: 1,
        productOrService: { coding: [{ system: CODE_SYSTEM_NDC, code: '00409488802' }] },
        quantity: { value: 2.5, unit: 'ML' },
      },
    ]);
  });

  it('leaves item.detail unset when the line has no drug', () => {
    expect(buildClaimItemDrugDetail(undefined)).toBeUndefined();
  });
});

describe('readClaimItemDrug', () => {
  it('round-trips what buildClaimItemDrugDetail stores', () => {
    const drug = { ndc: '00409488802', quantity: 10, units: 'ME' };
    expect(readClaimItemDrug(lineItem(buildClaimItemDrugDetail(drug)))).toEqual(drug);
  });

  it('finds the NDC detail among details in other code systems', () => {
    const item = lineItem([
      { sequence: 1, productOrService: { coding: [{ system: 'http://example.com/other', code: 'X' }] } },
      {
        sequence: 2,
        productOrService: { coding: [{ system: CODE_SYSTEM_NDC, code: '0409-4888-02' }] },
        quantity: { value: 1, unit: 'UN' },
      },
    ]);
    expect(readClaimItemDrug(item)).toEqual({ ndc: '0409-4888-02', quantity: 1, units: 'UN' });
  });

  it('defaults the unit to UN when the detail has no quantity unit', () => {
    const item = lineItem([
      { sequence: 1, productOrService: { coding: [{ system: CODE_SYSTEM_NDC, code: '0409-4888-02' }] } },
    ]);
    expect(readClaimItemDrug(item)).toEqual({ ndc: '0409-4888-02', quantity: 0, units: 'UN' });
  });

  it('returns undefined when the line has no NDC detail', () => {
    expect(readClaimItemDrug(lineItem())).toBeUndefined();
    expect(
      readClaimItemDrug(
        lineItem([{ sequence: 1, productOrService: { coding: [{ system: 'http://example.com/other', code: 'X' }] } }])
      )
    ).toBeUndefined();
  });
});
