import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { Claim, Coverage, FhirResource, ProvenanceAgent } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/update-billing-claim/index';
import { validateRequestParameters } from '../../../src/billing/update-billing-claim/validateRequestParameters';

const CLAIM_ID = '5f2b8c9e-1a3d-4e6f-8a7b-9c0d1e2f3a4b';
const agent: ProvenanceAgent = { who: { reference: 'Practitioner/test-user' } };

const claim: Claim = {
  resourceType: 'Claim',
  id: CLAIM_ID,
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
  insurance: [
    {
      sequence: 1,
      focal: true,
      coverage: {
        reference: 'Coverage/cov-1',
      },
    },
  ],
};

const coverage: Coverage = {
  resourceType: 'Coverage',
  id: 'cov-1',
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

const body = (fields: Record<string, unknown>): string =>
  JSON.stringify({
    resourceType: 'Claim',
    resourceId: CLAIM_ID,
    claimId: CLAIM_ID,
    fields,
  });

// All writes go through a transaction pairing each resource PUT with its history Provenance; pull the
// PUT resources back out for assertions.
const writtenResources = (transaction: ReturnType<typeof vi.fn>): FhirResource[] =>
  transaction.mock.calls
    .flatMap((call): BatchInputRequest<FhirResource>[] => call[0].requests)
    .filter((r) => r.method === 'PUT')
    .map((r) => (r as { resource: FhirResource }).resource);

describe('update-billing-claim validateRequestParameters', () => {
  it('accepts a valid candid plan type', () => {
    const result = validateRequestParameters({
      headers: null,
      body: body({
        planType: '12',
      }),
      secrets: {},
    });
    expect(result).toMatchObject({
      fields: {
        planType: '12',
      },
    });
  });

  it('rejects an unknown plan type', () => {
    expect(() =>
      validateRequestParameters({
        headers: null,
        body: body({
          planType: 'ZZZ',
        }),
        secrets: {},
      })
    ).toThrow(/plan type/i);
  });

  it('accepts an admission date and discharge date set together', () => {
    const result = validateRequestParameters({
      headers: null,
      body: body({
        admissionDate: '2026-01-01',
        dischargeDate: '2026-01-31',
      }),
      secrets: {},
    });
    expect(result).toMatchObject({
      fields: {
        admissionDate: '2026-01-01',
        dischargeDate: '2026-01-31',
      },
    });
  });

  it('rejects both admission date and discharge date submitted blank', () => {
    expect(() =>
      validateRequestParameters({
        headers: null,
        body: body({
          admissionDate: '',
          dischargeDate: '',
        }),
        secrets: {},
      })
    ).toThrow(/date is required/i);
  });

  it('rejects an admission date without a discharge date', () => {
    expect(() =>
      validateRequestParameters({
        headers: null,
        body: body({
          admissionDate: '2026-01-01',
          dischargeDate: '',
        }),
        secrets: {},
      })
    ).toThrow(/discharge date is required/i);
  });

  it('rejects a discharge date without an admission date', () => {
    expect(() =>
      validateRequestParameters({
        headers: null,
        body: body({
          admissionDate: '',
          dischargeDate: '2026-01-31',
        }),
        secrets: {},
      })
    ).toThrow(/admission date is required/i);
  });
});

describe('update-billing-claim performEffect', () => {
  const makeOystehr = (
    claimOverride: Claim = claim
  ): {
    oystehr: Oystehr;
    search: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  } => {
    const search = vi.fn().mockImplementation(({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Claim') return Promise.resolve({ unbundle: () => [structuredClone(claimOverride)] });
      if (resourceType === 'Coverage') return Promise.resolve({ unbundle: () => [structuredClone(coverage)] });
      return Promise.resolve({ unbundle: () => [] });
    });
    const transaction = vi.fn().mockResolvedValue({ entry: [] });
    const getPayer = vi.fn().mockResolvedValue({ resourceType: 'Organization', id: 'payer-1', name: 'Payer One' });
    return {
      oystehr: { fhir: { search, transaction }, rcm: { getPayer } } as unknown as Oystehr,
      search,
      transaction,
    };
  };

  it('applies payer and plan type to the focal coverage in a single fetch and write', async () => {
    const { oystehr, search, transaction } = makeOystehr();

    await performEffect(
      oystehr,
      {
        resourceType: 'Claim',
        resourceId: CLAIM_ID,
        claimId: CLAIM_ID,
        fields: {
          payerId: 'PAYER1',
          planType: '12',
        },
        secrets: {},
      },
      agent
    );

    // Focal coverage is not mutated by update claim
    expect(search).toHaveBeenCalledTimes(1);
    const coverageWrites = writtenResources(transaction).filter((r) => r.resourceType === 'Coverage');
    expect(coverageWrites).toHaveLength(0);
  });

  it('does not touch any coverage when no insurance type is provided', async () => {
    const { oystehr, search, transaction } = makeOystehr();

    await performEffect(
      oystehr,
      {
        resourceType: 'Claim',
        resourceId: CLAIM_ID,
        claimId: CLAIM_ID,
        fields: {},
        secrets: {},
      },
      agent
    );

    expect(search).toHaveBeenCalledTimes(1);
    const written = writtenResources(transaction);
    expect(written.some((r) => r.resourceType === 'Claim')).toBe(true);
    expect(written.some((r) => r.resourceType === 'Coverage')).toBe(false);
  });

  it('writes the admission/discharge period to Claim.billablePeriod', async () => {
    const { oystehr, transaction } = makeOystehr();

    await performEffect(
      oystehr,
      {
        resourceType: 'Claim',
        resourceId: CLAIM_ID,
        claimId: CLAIM_ID,
        fields: {
          admissionDate: '2026-01-01',
          dischargeDate: '2026-01-31',
        },
        secrets: {},
      },
      agent
    );

    const claimWrite = writtenResources(transaction).find((r) => r.resourceType === 'Claim') as Claim;
    expect(claimWrite.billablePeriod).toEqual({ start: '2026-01-01', end: '2026-01-31' });
  });

  it('does not clear an existing Claim.billablePeriod when both dates are submitted blank', async () => {
    const claimWithPeriod: Claim = { ...claim, billablePeriod: { start: '2026-01-01', end: '2026-01-31' } };
    const { oystehr, transaction } = makeOystehr(claimWithPeriod);

    await performEffect(
      oystehr,
      {
        resourceType: 'Claim',
        resourceId: CLAIM_ID,
        claimId: CLAIM_ID,
        fields: {
          admissionDate: '',
          dischargeDate: '',
        },
        secrets: {},
      },
      agent
    );

    const claimWrite = writtenResources(transaction).find((r) => r.resourceType === 'Claim') as Claim;
    expect(claimWrite.billablePeriod).toEqual({ start: '2026-01-01', end: '2026-01-31' });
  });

  it('stays unset when both dates are submitted blank on a claim with no billablePeriod', async () => {
    const { oystehr, transaction } = makeOystehr();

    await performEffect(
      oystehr,
      {
        resourceType: 'Claim',
        resourceId: CLAIM_ID,
        claimId: CLAIM_ID,
        fields: {
          admissionDate: '',
          dischargeDate: '',
        },
        secrets: {},
      },
      agent
    );

    const claimWrite = writtenResources(transaction).find((r) => r.resourceType === 'Claim') as Claim;
    expect(claimWrite.billablePeriod).toBeUndefined();
  });
});
