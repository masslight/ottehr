import Oystehr from '@oystehr/sdk';
import { Claim, Coverage } from 'fhir/r4b';
import { CANDID_PLAN_TYPE_SYSTEM, EXTENSION_CLAIM_INSURANCE_TYPE, getPayerUrl } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/update-billing-claim/index';
import { validateRequestParameters } from '../../../src/billing/update-billing-claim/validateRequestParameters';

const claim: Claim = {
  resourceType: 'Claim',
  id: 'claim-1',
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
    resourceId: 'claim-1',
    fields,
  });

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
});

describe('update-billing-claim performEffect', () => {
  it('writes the plan type to the claim extension and the focal coverage type', async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({ unbundle: () => [structuredClone(claim)] })
      .mockResolvedValueOnce({ unbundle: () => [structuredClone(coverage)] });
    const update = vi.fn().mockImplementation((resource) => Promise.resolve(resource));
    const oystehr = {
      fhir: {
        search,
        update,
      },
    } as unknown as Oystehr;

    await performEffect(oystehr, {
      resourceType: 'Claim',
      resourceId: 'claim-1',
      fields: {
        planType: '12',
      },
      secrets: {},
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Claim',
        extension: expect.arrayContaining([
          {
            url: EXTENSION_CLAIM_INSURANCE_TYPE,
            valueString: '12',
          },
        ]),
      })
    );
    const coverageUpdate = update.mock.calls.find(([r]) => r.resourceType === 'Coverage')?.[0] as Coverage;
    expect(coverageUpdate.type?.coding).toContainEqual({
      system: CANDID_PLAN_TYPE_SYSTEM,
      code: '12',
    });
    expect(coverageUpdate.extension?.some((e) => e.url === EXTENSION_CLAIM_INSURANCE_TYPE)).toBeFalsy();
  });

  it('applies payer and plan type in a single coverage fetch/update, with the plan type on the claim', async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({ unbundle: () => [structuredClone(claim)] })
      .mockResolvedValueOnce({ unbundle: () => [structuredClone(coverage)] });
    const update = vi.fn().mockImplementation((resource) => Promise.resolve(resource));
    const oystehr = {
      fhir: {
        search,
        update,
      },
    } as unknown as Oystehr;

    await performEffect(oystehr, {
      resourceType: 'Claim',
      resourceId: 'claim-1',
      fields: {
        payerId: 'PAYER1',
        planType: '12',
      },
      secrets: {},
    });

    // Focal coverage is read once and written once, carrying the payer and the candid type coding.
    expect(search).toHaveBeenCalledTimes(2);
    const coverageUpdates = update.mock.calls.filter(([resource]) => resource.resourceType === 'Coverage');
    expect(coverageUpdates).toHaveLength(1);
    expect(coverageUpdates[0][0]).toEqual(
      expect.objectContaining({
        id: 'cov-1',
        payor: [
          {
            reference: getPayerUrl('PAYER1'),
          },
        ],
        type: expect.objectContaining({
          coding: expect.arrayContaining([
            {
              system: CANDID_PLAN_TYPE_SYSTEM,
              code: '12',
            },
          ]),
        }),
      })
    );
    expect(
      coverageUpdates[0][0].extension?.some((e: { url?: string }) => e.url === EXTENSION_CLAIM_INSURANCE_TYPE)
    ).toBeFalsy();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Claim',
        extension: expect.arrayContaining([
          {
            url: EXTENSION_CLAIM_INSURANCE_TYPE,
            valueString: '12',
          },
        ]),
      })
    );
  });

  it('does not touch any coverage when no insurance type is provided', async () => {
    const search = vi.fn().mockResolvedValueOnce({ unbundle: () => [structuredClone(claim)] });
    const update = vi.fn().mockImplementation((resource) => Promise.resolve(resource));
    const oystehr = {
      fhir: {
        search,
        update,
      },
    } as unknown as Oystehr;

    await performEffect(oystehr, {
      resourceType: 'Claim',
      resourceId: 'claim-1',
      fields: {},
      secrets: {},
    });

    expect(search).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ resourceType: 'Claim' }));
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ resourceType: 'Coverage' }));
  });

  it('clears the plan type extension when coverage is removed (self-pay)', async () => {
    const insuredClaim: Claim = {
      ...structuredClone(claim),
      extension: [
        {
          url: EXTENSION_CLAIM_INSURANCE_TYPE,
          valueString: '12',
        },
      ],
    };
    const search = vi.fn().mockResolvedValueOnce({ unbundle: () => [insuredClaim] });
    const update = vi.fn().mockImplementation((resource) => Promise.resolve(resource));
    const oystehr = {
      fhir: {
        search,
        update,
      },
    } as unknown as Oystehr;

    await performEffect(oystehr, {
      resourceType: 'Claim',
      resourceId: 'claim-1',
      fields: {
        removeCoverage: true,
      },
      secrets: {},
    });

    const claimUpdate = update.mock.calls.find(([r]) => r.resourceType === 'Claim')?.[0] as Claim;
    expect(claimUpdate.extension?.some((e: { url?: string }) => e.url === EXTENSION_CLAIM_INSURANCE_TYPE)).toBeFalsy();
  });
});
