import { Bundle, ClaimResponse, FhirResource, PaymentReconciliation, Provenance } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG } from 'utils';
import { describe, expect, it } from 'vitest';
import { addBillingTagOperation, untaggedEraResources } from '../../../src/billing/shared';

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
