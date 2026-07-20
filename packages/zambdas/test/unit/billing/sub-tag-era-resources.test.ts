import Oystehr from '@oystehr/sdk';
import { ClaimResponse, PaymentReconciliation, Provenance } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG } from 'utils';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { ERA_PROCESSING_ACTIVITY_CODE, PROVENANCE_ACTIVITY_TYPE_SYSTEM } from '../../../src/billing/shared';
import { ZambdaInput } from '../../../src/shared';
import {
  complexValidation,
  performEffect,
} from '../../../src/subscriptions/payment-reconciliation/sub-tag-era-resources';
import { validateRequestParameters } from '../../../src/subscriptions/payment-reconciliation/sub-tag-era-resources/validateRequestParameters';

const provenance = (id: string, targets: string[], tagged = false): Provenance => ({
  resourceType: 'Provenance',
  id,
  recorded: '2026-01-14T00:00:00Z',
  agent: [
    {
      who: {
        display: 'Oystehr RCM',
      },
    },
  ],
  activity: {
    coding: [
      {
        system: PROVENANCE_ACTIVITY_TYPE_SYSTEM,
        code: ERA_PROCESSING_ACTIVITY_CODE,
      },
    ],
  },
  target: targets.map((reference) => ({ reference })),
  ...(tagged
    ? {
        meta: {
          tag: [BILLING_RESOURCE_TAG],
        },
      }
    : {}),
});

const claimResponse = (id: string, tagged = false): ClaimResponse => ({
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
  ...(tagged
    ? {
        meta: {
          tag: [BILLING_RESOURCE_TAG],
        },
      }
    : {}),
});

const paymentReconciliation = (id: string, tagged = false): PaymentReconciliation => ({
  resourceType: 'PaymentReconciliation',
  id,
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

const searchBundle = (resources: (ClaimResponse | PaymentReconciliation | Provenance)[]): unknown => ({
  entry: resources.map((resource) => ({ resource })),
  total: resources.length,
  unbundle: () => resources,
});

type SearchInput = { resourceType: string };
type ResultsByType = {
  Provenance?: Provenance[];
  ClaimResponse?: ClaimResponse[];
  PaymentReconciliation?: PaymentReconciliation[];
};

// Dispatches search results by resourceType and lets Provenance return a different result per call
// (to drive the retry loop). transaction just echoes an empty response.
const makeOystehr = (
  resultsByType: ResultsByType,
  provenancePages?: Provenance[][]
): { oystehr: Oystehr; search: Mock; transaction: Mock } => {
  let provenanceCall = 0;
  const search = vi.fn().mockImplementation(({ resourceType }: SearchInput) => {
    if (resourceType === 'Provenance' && provenancePages) {
      const page = provenancePages[Math.min(provenanceCall, provenancePages.length - 1)];
      provenanceCall++;
      return Promise.resolve(searchBundle(page));
    }
    return Promise.resolve(searchBundle(resultsByType[resourceType as keyof ResultsByType] ?? []));
  });
  const transaction = vi.fn().mockResolvedValue({ entry: [] });
  return {
    oystehr: {
      fhir: {
        search,
        transaction,
      },
    } as unknown as Oystehr,
    search,
    transaction,
  };
};

const zambdaInput = (body: unknown): ZambdaInput =>
  ({
    body: JSON.stringify(body),
    headers: null,
    secrets: {} as any,
  }) as ZambdaInput;

describe('validateRequestParameters', () => {
  it('returns the PaymentReconciliation id and secrets for a valid body', () => {
    const result = validateRequestParameters(zambdaInput(paymentReconciliation('pr1')));
    expect(result.paymentReconciliationId).toBe('pr1');
    expect(result.secrets).toEqual({});
  });

  it('rejects a body that is not a PaymentReconciliation', () => {
    expect(() =>
      validateRequestParameters(
        zambdaInput({
          resourceType: 'Task',
          id: 't1',
        })
      )
    ).toThrow();
  });

  it('rejects a PaymentReconciliation without an id', () => {
    expect(() =>
      validateRequestParameters(
        zambdaInput({
          resourceType: 'PaymentReconciliation',
        })
      )
    ).toThrow();
  });

  it('rejects a missing body', () => {
    expect(() =>
      validateRequestParameters({
        body: null,
        headers: null,
        secrets: {} as any,
      })
    ).toThrow();
  });

  it('rejects missing secrets', () => {
    expect(() =>
      validateRequestParameters({
        body: JSON.stringify(paymentReconciliation('pr1')),
        headers: null,
        secrets: null,
      })
    ).toThrow();
  });
});

describe('complexValidation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the era-processing Provenance found on the first attempt', async () => {
    const prov = provenance('prov1', ['PaymentReconciliation/pr1', 'ClaimResponse/cr1']);
    const { oystehr, search } = makeOystehr({}, [[prov]]);

    const validated = await complexValidation(oystehr, 'pr1');

    expect(validated).toEqual({
      paymentReconciliationId: 'pr1',
      provenances: [prov],
    });
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('retries until the Provenance appears', async () => {
    const prov = provenance('prov1', ['PaymentReconciliation/pr1']);
    const { oystehr, search } = makeOystehr({}, [[], [], [prov]]);

    const promise = complexValidation(oystehr, 'pr1');
    await vi.runAllTimersAsync();
    const validated = await promise;

    expect(validated.provenances).toEqual([prov]);
    expect(search).toHaveBeenCalledTimes(3);
  });

  it('throws and tags nothing when the Provenance never appears', async () => {
    const { oystehr, search, transaction } = makeOystehr({}, [[]]);

    const settled = complexValidation(oystehr, 'pr1').catch((error) => error);
    await vi.runAllTimersAsync();
    const result = await settled;

    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toMatch(/No era-processing Provenance/);
    expect(search.mock.calls.filter((c) => c[0].resourceType === 'Provenance')).toHaveLength(5);
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe('performEffect', () => {
  it('tags the PaymentReconciliation, its Provenance, and its ClaimResponses in one transaction', async () => {
    const prov = provenance('prov1', ['PaymentReconciliation/pr1', 'ClaimResponse/cr1', 'ClaimResponse/cr2']);
    const { oystehr, transaction } = makeOystehr({
      Provenance: [prov],
      PaymentReconciliation: [paymentReconciliation('pr1')],
      ClaimResponse: [claimResponse('cr1'), claimResponse('cr2')],
    });

    const result = await performEffect(oystehr, {
      paymentReconciliationId: 'pr1',
      provenances: [prov],
    });

    expect(result).toEqual({ tagged: 4 });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0][0].requests).toHaveLength(4);
  });

  it('skips already-tagged resources and makes no transaction when nothing needs tagging', async () => {
    const prov = provenance('prov1', ['PaymentReconciliation/pr1', 'ClaimResponse/cr1'], true);
    const { oystehr, transaction } = makeOystehr({
      Provenance: [prov],
      PaymentReconciliation: [paymentReconciliation('pr1', true)],
      ClaimResponse: [claimResponse('cr1', true)],
    });

    const result = await performEffect(oystehr, {
      paymentReconciliationId: 'pr1',
      provenances: [prov],
    });

    expect(result).toEqual({ tagged: 0 });
    expect(transaction).not.toHaveBeenCalled();
  });
});
