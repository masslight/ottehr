import Oystehr from '@oystehr/sdk';
import { Bundle, ClaimResponse, FhirResource, PaymentReconciliation, Provenance } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { addBillingTagOperation, tagEraResources, untaggedEraResources } from '../../../src/billing/shared';

const paymentReconciliation = (id?: string, tagged = false): PaymentReconciliation => ({
  resourceType: 'PaymentReconciliation',
  ...(id ? { id } : {}),
  status: 'active',
  created: '2026-01-14',
  paymentDate: '2026-01-15',
  paymentAmount: {
    value: 350,
    currency: 'USD',
  },
  ...(tagged
    ? {
        meta: {
          tag: [BILLING_RESOURCE_TAG],
        },
      }
    : {}),
});

const claimResponse = (id: string): ClaimResponse => ({
  resourceType: 'ClaimResponse',
  id,
  status: 'active',
  type: {
    coding: [
      {
        code: 'professional',
      },
    ],
  },
  use: 'claim',
  patient: {
    reference: 'Patient/p1',
  },
  created: '2026-01-14',
  insurer: {
    display: 'Test Payer',
  },
  outcome: 'complete',
});

const bundleOf = (...resources: FhirResource[]): Bundle => ({
  resourceType: 'Bundle',
  type: 'transaction-response',
  entry: resources.map((resource) => ({ resource })),
});

describe('untaggedEraResources', () => {
  it('picks the created PaymentReconciliation and ClaimResponses out of the response bundle', () => {
    const pr = paymentReconciliation('pr1');
    const cr = claimResponse('cr1');
    expect(untaggedEraResources(bundleOf(pr, cr))).toEqual([pr, cr]);
  });

  it('skips resources that already carry the billing tag', () => {
    const taggedPr = paymentReconciliation('pr1', true);
    const cr = claimResponse('cr1');
    expect(untaggedEraResources(bundleOf(taggedPr, cr))).toEqual([cr]);
  });

  it('includes untagged resources of any type', () => {
    const provenance: Provenance = {
      resourceType: 'Provenance',
      id: 'prov1',
      target: [
        {
          reference: 'PaymentReconciliation/pr1',
        },
      ],
      recorded: '2026-01-14T00:00:00Z',
      agent: [
        {
          who: {
            display: 'Oystehr RCM',
          },
        },
      ],
    };
    expect(untaggedEraResources(bundleOf(provenance))).toEqual([provenance]);
  });

  it('skips entries without a resource and resources without an id', () => {
    const bundle: Bundle = {
      resourceType: 'Bundle',
      type: 'transaction-response',
      entry: [
        {},
        {
          resource: paymentReconciliation(),
        },
      ],
    };
    expect(untaggedEraResources(bundle)).toEqual([]);
  });

  it('returns empty for a bundle without entries', () => {
    const bundle: Bundle = {
      resourceType: 'Bundle',
      type: 'transaction-response',
    };
    expect(untaggedEraResources(bundle)).toEqual([]);
  });
});

describe('addBillingTagOperation', () => {
  it('creates the tag array when the resource has no tags', () => {
    expect(addBillingTagOperation(paymentReconciliation('pr1'))).toEqual({
      op: 'add',
      path: '/meta/tag',
      value: [BILLING_RESOURCE_TAG],
    });
  });

  it('preserves existing tags', () => {
    const otherTag = {
      system: 'https://example.com/tags',
      code: 'other',
    };
    const resource: PaymentReconciliation = {
      ...paymentReconciliation('pr1'),
      meta: {
        tag: [otherTag],
      },
    };
    expect(addBillingTagOperation(resource)).toEqual({
      op: 'add',
      path: '/meta/tag',
      value: [otherTag, BILLING_RESOURCE_TAG],
    });
  });
});

describe('tagEraResources', () => {
  const makeOystehr = (): {
    oystehr: Oystehr;
    transaction: ReturnType<typeof vi.fn>;
  } => {
    const transaction = vi.fn().mockResolvedValue({ entry: [] });
    const oystehr = {
      fhir: {
        transaction,
      },
    } as unknown as Oystehr;
    return {
      oystehr,
      transaction,
    };
  };

  it('patches every untagged resource in one transaction and returns the count', async () => {
    const { oystehr, transaction } = makeOystehr();
    const pr = paymentReconciliation('pr1');
    const cr = claimResponse('cr1');

    const tagged = await tagEraResources({
      oystehr,
      resources: [pr, cr],
    });

    expect(tagged).toBe(2);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0][0].requests).toHaveLength(2);
  });

  it('skips resources that already carry the billing tag', async () => {
    const { oystehr, transaction } = makeOystehr();
    const taggedPr = paymentReconciliation('pr1', true);
    const cr = claimResponse('cr1');

    const tagged = await tagEraResources({
      oystehr,
      resources: [taggedPr, cr],
    });

    expect(tagged).toBe(1);
    expect(transaction.mock.calls[0][0].requests).toHaveLength(1);
  });

  it('makes no transaction when nothing needs tagging', async () => {
    const { oystehr, transaction } = makeOystehr();

    const tagged = await tagEraResources({
      oystehr,
      resources: [paymentReconciliation('pr1', true)],
    });

    expect(tagged).toBe(0);
    expect(transaction).not.toHaveBeenCalled();
  });
});
