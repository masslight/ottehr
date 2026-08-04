import { Claim, ClaimResponse } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  claimMatchesServiceDateRange,
  getClaimServiceDate,
  mapClaimToItem,
} from '../../../src/billing/search-billing-claims';

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

const makeServiceDatedClaim = (created: string, servicedStart?: string): Claim =>
  ({
    resourceType: 'Claim',
    created,
    item: servicedStart
      ? [
          {
            servicedPeriod: {
              start: servicedStart,
            },
          },
        ]
      : undefined,
  }) as unknown as Claim;

const makeLookups = (
  patientPaidByClaimId: Map<string, number>,
  claimResponsesByClaimId: Map<string, ClaimResponse[]> = new Map(),
  providers: Lookups['providers'] = []
): Lookups => ({
  patients: [],
  payersByRef: new Map(),
  locations: [],
  providers,
  coverages: [],
  claimResponsesByClaimId,
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

describe('mapClaimToItem: adjudicated flag', () => {
  const claimResponse = {
    resourceType: 'ClaimResponse',
    id: 'cr-1',
    status: 'active',
    request: {
      reference: 'Claim/claim-1',
    },
  } as unknown as ClaimResponse;

  it('marks a claim with no remittance as un-adjudicated, so the list can flag its balance', () => {
    const item = mapClaimToItem(makeClaim('claim-1', 100), makeLookups(new Map()));
    expect(item.adjudicated).toBe(false);
  });

  it('marks a claim with a remittance as adjudicated', () => {
    const item = mapClaimToItem(
      makeClaim('claim-1', 100),
      makeLookups(new Map(), new Map([['claim-1', [claimResponse]]]))
    );
    expect(item.adjudicated).toBe(true);
  });
});

describe('mapClaimToItem: rendering provider', () => {
  const withRenderingProvider = (reference: string): Claim =>
    ({
      ...makeClaim('claim-1', 100),
      careTeam: [
        {
          sequence: 1,
          provider: {
            reference,
          },
        },
      ],
    }) as unknown as Claim;

  it('names a Practitioner rendering provider', () => {
    const practitioner = {
      resourceType: 'Practitioner',
      id: '1',
      name: [
        {
          family: 'Black',
          given: ['Oliver'],
        },
      ],
    } as unknown as Lookups['providers'][number];

    const item = mapClaimToItem(
      withRenderingProvider('Practitioner/1'),
      makeLookups(new Map(), new Map(), [practitioner])
    );
    expect(item.renderingProvider).toBe('Black, Oliver');
  });

  it('names an Organization rendering provider', () => {
    const organization = {
      resourceType: 'Organization',
      id: 'org-1',
      name: 'Riverside Group',
    } as unknown as Lookups['providers'][number];

    const item = mapClaimToItem(
      withRenderingProvider('Organization/org-1'),
      makeLookups(new Map(), new Map(), [organization])
    );
    expect(item.renderingProvider).toBe('Riverside Group');
  });

  it('leaves the column blank when the claim has no care team', () => {
    const item = mapClaimToItem(makeClaim('claim-1', 100), makeLookups(new Map()));
    expect(item.renderingProvider).toBe('');
  });
});

describe('search-billing-claims service date', () => {
  it('derives the service date from the first service line, not the creation date', () => {
    expect(getClaimServiceDate(makeServiceDatedClaim('2026-07-21', '2026-07-19'))).toBe('2026-07-19');
  });

  it('falls back to created only when the claim has no service line', () => {
    expect(getClaimServiceDate(makeServiceDatedClaim('2026-07-21'))).toBe('2026-07-21');
  });

  it('windows on the service date, not the creation date', () => {
    const claim = makeServiceDatedClaim('2026-07-21', '2026-07-19');
    expect(claimMatchesServiceDateRange(claim, '2026-07-21', '2026-07-21')).toBe(false);
    expect(claimMatchesServiceDateRange(claim, '2026-07-19', '2026-07-19')).toBe(true);
  });

  it('matches inside an inclusive range and excludes outside it, with open-ended bounds', () => {
    const claim = makeServiceDatedClaim('2026-07-25', '2026-07-20');
    expect(claimMatchesServiceDateRange(claim, '2026-07-19', '2026-07-21')).toBe(true);
    expect(claimMatchesServiceDateRange(claim, '2026-07-21', '2026-07-31')).toBe(false);
    expect(claimMatchesServiceDateRange(claim, undefined, '2026-07-20')).toBe(true);
    expect(claimMatchesServiceDateRange(claim, '2026-07-20', undefined)).toBe(true);
  });

  it('includes same-day claims when bounds are passed as ISO datetimes', () => {
    const claim = makeServiceDatedClaim('2026-07-21', '2026-07-19');
    expect(claimMatchesServiceDateRange(claim, '2026-07-19T00:00:00Z', '2026-07-19T23:59:59Z')).toBe(true);
  });
});
