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
  it('mirrors the plan type onto the focal coverage extension and type', async () => {
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
        resourceType: 'Coverage',
        id: 'cov-1',
        extension: expect.arrayContaining([
          {
            url: EXTENSION_CLAIM_INSURANCE_TYPE,
            valueString: '12',
          },
        ]),
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
  });

  it('applies payer and plan type to the focal coverage in a single fetch and update', async () => {
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

    // Focal coverage is read once and written once, carrying both the payer and the plan type.
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
        extension: expect.arrayContaining([
          {
            url: EXTENSION_CLAIM_INSURANCE_TYPE,
            valueString: '12',
          },
        ]),
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
});
