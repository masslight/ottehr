import Oystehr from '@oystehr/sdk';
import { ClaimResponse, PaymentReconciliation } from 'fhir/r4b';
import { describe, expect, it, Mock, vi } from 'vitest';
import {
  claimResponseBelongsToEra,
  fetchClaimResponsesByPaymentReconciliations,
  fetchPaymentReconciliationsByClaimResponses,
} from '../../../src/billing/claim-amounts';
import {
  CLAIM_RESPONSE_PAYMENT_RECONCILIATION_EXTENSION,
  ERA_ID_SYSTEM,
  getLinkedClaimResponseIds,
  getLinkedPaymentReconciliationId,
  PAYMENT_RECONCILIATION_CLAIM_RESPONSES_EXTENSION,
} from '../../../src/billing/shared';

const claimResponseLink = (reference: string): { url: string; valueReference: { reference: string } } => ({
  url: PAYMENT_RECONCILIATION_CLAIM_RESPONSES_EXTENSION,
  valueReference: { reference },
});

describe('getLinkedClaimResponseIds', () => {
  it('returns the ids of rcm-claim-responses references', () => {
    const pr = {
      extension: [claimResponseLink('ClaimResponse/cr1'), claimResponseLink('ClaimResponse/cr2')],
    };
    expect(getLinkedClaimResponseIds(pr)).toEqual(['cr1', 'cr2']);
  });

  it('ignores other extensions and non-relative references', () => {
    const pr = {
      extension: [
        {
          url: 'https://extensions.fhir.oystehr.com/era-status-code',
          valueString: '1',
        },
        claimResponseLink('urn:uuid:0f4a4e21-6ae9-4a03-9e0f-9c2a3e8f4f11'),
        claimResponseLink('ClaimResponse/cr1'),
      ],
    };
    expect(getLinkedClaimResponseIds(pr)).toEqual(['cr1']);
  });

  it('returns empty when the resource has no extensions', () => {
    expect(getLinkedClaimResponseIds({})).toEqual([]);
  });
});

describe('getLinkedPaymentReconciliationId', () => {
  it('returns the id of the rcm-payment-reconciliation back-reference', () => {
    const cr = {
      extension: [
        {
          url: CLAIM_RESPONSE_PAYMENT_RECONCILIATION_EXTENSION,
          valueReference: { reference: 'PaymentReconciliation/pr1' },
        },
      ],
    };
    expect(getLinkedPaymentReconciliationId(cr)).toBe('pr1');
  });

  it('returns undefined without the extension', () => {
    expect(getLinkedPaymentReconciliationId({})).toBeUndefined();
  });

  it('returns undefined for a non-relative reference', () => {
    const cr = {
      extension: [
        {
          url: CLAIM_RESPONSE_PAYMENT_RECONCILIATION_EXTENSION,
          valueReference: { reference: 'urn:uuid:0f4a4e21-6ae9-4a03-9e0f-9c2a3e8f4f11' },
        },
      ],
    };
    expect(getLinkedPaymentReconciliationId(cr)).toBeUndefined();
  });
});

const paymentReconciliation = (
  id: string,
  parts: { eraId?: string; linkedCrIds?: string[] } = {}
): PaymentReconciliation => ({
  resourceType: 'PaymentReconciliation',
  id,
  status: 'active',
  created: '2026-01-14',
  paymentDate: '2026-01-15',
  paymentAmount: {
    value: 350,
    currency: 'USD',
  },
  ...(parts.eraId
    ? {
        identifier: [
          {
            system: ERA_ID_SYSTEM,
            value: parts.eraId,
          },
        ],
      }
    : {}),
  ...(parts.linkedCrIds
    ? {
        extension: parts.linkedCrIds.map((crId) => claimResponseLink(`ClaimResponse/${crId}`)),
      }
    : {}),
});

const claimResponse = (id: string, parts: { eraId?: string; linkedPrId?: string } = {}): ClaimResponse => ({
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
  ...(parts.eraId
    ? {
        identifier: [
          {
            system: ERA_ID_SYSTEM,
            value: parts.eraId,
          },
        ],
      }
    : {}),
  ...(parts.linkedPrId
    ? {
        extension: [
          {
            url: CLAIM_RESPONSE_PAYMENT_RECONCILIATION_EXTENSION,
            valueReference: {
              reference: `PaymentReconciliation/${parts.linkedPrId}`,
            },
          },
        ],
      }
    : {}),
});

const searchBundle = (resources: (ClaimResponse | PaymentReconciliation)[]): unknown => ({
  entry: resources.map((resource) => ({ resource })),
  total: resources.length,
  unbundle: () => resources,
});

type SearchParam = { name: string; value: string };

const makeOystehr = (
  resultsByParam: Record<string, (ClaimResponse | PaymentReconciliation)[]>
): { oystehr: Oystehr; search: Mock } => {
  const search = vi.fn().mockImplementation(({ params }: { params: SearchParam[] }) => {
    const key = params.find((p) => p.name === 'identifier' || p.name === '_id')?.name ?? '';
    return Promise.resolve(searchBundle(resultsByParam[key] ?? []));
  });
  return {
    oystehr: {
      fhir: {
        search,
      },
    } as unknown as Oystehr,
    search,
  };
};

const searchParam = (search: Mock, callIndex: number, name: string): string | undefined =>
  (search.mock.calls[callIndex][0].params as SearchParam[]).find((p) => p.name === name)?.value;

describe('fetchClaimResponsesByPaymentReconciliations', () => {
  it('fetches by era-id identifier when present, even if the PR also carries link extensions', async () => {
    const pr = paymentReconciliation('pr1', {
      eraId: 'era1',
      linkedCrIds: ['cr1'],
    });
    const cr = claimResponse('cr1', { eraId: 'era1' });
    const { oystehr, search } = makeOystehr({ identifier: [cr] });

    const grouped = await fetchClaimResponsesByPaymentReconciliations(oystehr, [pr]);

    expect(grouped.get('pr1')).toEqual([cr]);
    expect(search).toHaveBeenCalledTimes(1);
    expect(searchParam(search, 0, 'identifier')).toBe(`${ERA_ID_SYSTEM}|era1`);
  });

  it('falls back to the rcm link extensions when the PR has no era-id', async () => {
    const pr = paymentReconciliation('pr1', { linkedCrIds: ['cr1', 'cr2'] });
    const crs = [claimResponse('cr1'), claimResponse('cr2')];
    const { oystehr, search } = makeOystehr({ _id: crs });

    const grouped = await fetchClaimResponsesByPaymentReconciliations(oystehr, [pr]);

    expect(grouped.get('pr1')).toEqual(crs);
    expect(search).toHaveBeenCalledTimes(1);
    expect(searchParam(search, 0, '_id')).toBe('cr1,cr2');
  });

  it('groups a mixed batch by PR id and leaves PRs without any linkage out of the map', async () => {
    const eraIdPr = paymentReconciliation('pr1', { eraId: 'era1' });
    const linkedPr = paymentReconciliation('pr2', { linkedCrIds: ['cr2'] });
    const unlinkedPr = paymentReconciliation('pr3');
    const eraIdCr = claimResponse('cr1', { eraId: 'era1' });
    const linkedCr = claimResponse('cr2');
    const { oystehr } = makeOystehr({
      identifier: [eraIdCr],
      _id: [linkedCr],
    });

    const grouped = await fetchClaimResponsesByPaymentReconciliations(oystehr, [eraIdPr, linkedPr, unlinkedPr]);

    expect(grouped.get('pr1')).toEqual([eraIdCr]);
    expect(grouped.get('pr2')).toEqual([linkedCr]);
    expect(grouped.has('pr3')).toBe(false);
  });
});

describe('fetchPaymentReconciliationsByClaimResponses', () => {
  it('fetches PRs by era-id identifier for CRs that carry one', async () => {
    const cr = claimResponse('cr1', { eraId: 'era1' });
    const pr = paymentReconciliation('pr1', { eraId: 'era1' });
    const { oystehr, search } = makeOystehr({ identifier: [pr] });

    const result = await fetchPaymentReconciliationsByClaimResponses(oystehr, [cr]);

    expect(result).toEqual([pr]);
    expect(search).toHaveBeenCalledTimes(1);
    expect(searchParam(search, 0, 'identifier')).toBe(`${ERA_ID_SYSTEM}|era1`);
  });

  it('falls back to the rcm back-reference when the CR has no era-id', async () => {
    const cr = claimResponse('cr1', { linkedPrId: 'pr1' });
    const pr = paymentReconciliation('pr1');
    const { oystehr, search } = makeOystehr({ _id: [pr] });

    const result = await fetchPaymentReconciliationsByClaimResponses(oystehr, [cr]);

    expect(result).toEqual([pr]);
    expect(search).toHaveBeenCalledTimes(1);
    expect(searchParam(search, 0, '_id')).toBe('pr1');
  });

  it('dedupes a PR found through both linkages', async () => {
    const eraIdCr = claimResponse('cr1', { eraId: 'era1' });
    const linkedCr = claimResponse('cr2', { linkedPrId: 'pr1' });
    const pr = paymentReconciliation('pr1', { eraId: 'era1' });
    const { oystehr, search } = makeOystehr({
      identifier: [pr],
      _id: [pr],
    });

    const result = await fetchPaymentReconciliationsByClaimResponses(oystehr, [eraIdCr, linkedCr]);

    expect(result).toEqual([pr]);
    expect(search).toHaveBeenCalledTimes(2);
  });
});

describe('claimResponseBelongsToEra', () => {
  it('matches by era-id when the PR carries one', () => {
    const pr = paymentReconciliation('pr1', { eraId: 'era1' });
    expect(claimResponseBelongsToEra(claimResponse('cr1', { eraId: 'era1' }), pr)).toBe(true);
    expect(claimResponseBelongsToEra(claimResponse('cr2', { eraId: 'era2' }), pr)).toBe(false);
  });

  it('era-id takes precedence over a matching back-reference', () => {
    const pr = paymentReconciliation('pr1', { eraId: 'era1' });
    expect(claimResponseBelongsToEra(claimResponse('cr1', { linkedPrId: 'pr1' }), pr)).toBe(false);
  });

  it('falls back to the rcm back-reference when the PR has no era-id', () => {
    const pr = paymentReconciliation('pr1');
    expect(claimResponseBelongsToEra(claimResponse('cr1', { linkedPrId: 'pr1' }), pr)).toBe(true);
    expect(claimResponseBelongsToEra(claimResponse('cr2'), pr)).toBe(false);
  });
});
