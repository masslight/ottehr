import { Claim } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { mapClaimToItem } from '../../../src/billing/search-billing-claims';

type Lookups = Parameters<typeof mapClaimToItem>[1];

const makeClaim = (id: string, billed: number): Claim =>
  ({
    resourceType: 'Claim',
    id,
    status: 'active',
    created: '2026-07-01',
    type: {
      coding: [],
    },
    insurance: [],
    total: {
      value: billed,
      currency: 'USD',
    },
    meta: {
      tag: [],
    },
  }) as unknown as Claim;

const makeLookups = (patientPaidByClaimId: Map<string, number>): Lookups => ({
  patients: [],
  payersByRef: new Map(),
  locations: [],
  practitioners: [],
  coverages: [],
  claimResponsesByClaimId: new Map(),
  patientPaidByClaimId,
});

describe('mapClaimToItem: patient payments', () => {
  it('reports the linked patient payment total and nets it from the balance', () => {
    const item = mapClaimToItem(makeClaim('claim-1', 100), makeLookups(new Map([['claim-1', 30]])));
    expect(item.patientPaid).toBe(30);
    expect(item.claimBalance).toBe(70);
  });

  it('defaults patient paid to zero when the claim has no linked payments', () => {
    const item = mapClaimToItem(makeClaim('claim-2', 100), makeLookups(new Map()));
    expect(item.patientPaid).toBe(0);
    expect(item.claimBalance).toBe(100);
  });
});
