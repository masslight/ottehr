import Oystehr from '@oystehr/sdk';
import { ClaimResponse, PaymentReconciliation, Provenance } from 'fhir/r4b';
import { describe, expect, it, Mock, vi } from 'vitest';
import { fetchClaimEraLinks, fetchClaimResponsesByPaymentReconciliations } from '../../../src/billing/claim-amounts';
import {
  ERA_PROCESSING_ACTIVITY_CODE,
  isEraProcessingProvenance,
  PROVENANCE_ACTIVITY_TYPE_SYSTEM,
} from '../../../src/billing/shared';

const provenance = (
  id: string,
  targets: string[],
  activityCode: string = ERA_PROCESSING_ACTIVITY_CODE
): Provenance => ({
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
        code: activityCode,
      },
    ],
  },
  target: targets.map((reference) => ({ reference })),
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

const makePaymentReconciliation = (id: string): PaymentReconciliation => ({
  resourceType: 'PaymentReconciliation',
  id,
  status: 'active',
  created: '2026-01-14',
  paymentDate: '2026-01-15',
  paymentAmount: {
    value: 350,
    currency: 'USD',
  },
});

const searchBundle = (resources: (ClaimResponse | PaymentReconciliation | Provenance)[]): unknown => ({
  entry: resources.map((resource) => ({ resource })),
  total: resources.length,
  unbundle: () => resources,
});

type SearchParam = { name: string; value: string };
type SearchInput = { resourceType: string; params: SearchParam[] };
type ResultsByType = {
  Provenance?: Provenance[];
  ClaimResponse?: ClaimResponse[];
  PaymentReconciliation?: PaymentReconciliation[];
};

const makeOystehr = (resultsByType: ResultsByType): { oystehr: Oystehr; search: Mock } => {
  const search = vi.fn().mockImplementation(({ resourceType }: SearchInput) => {
    const results = resultsByType[resourceType as keyof ResultsByType] ?? [];
    return Promise.resolve(searchBundle(results));
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

const searchParamFor = (search: Mock, resourceType: string, name: string): string | undefined => {
  const call = search.mock.calls.find((c) => (c[0] as SearchInput).resourceType === resourceType);
  return (call?.[0] as SearchInput | undefined)?.params.find((p) => p.name === name)?.value;
};

describe('isEraProcessingProvenance', () => {
  it('is true for the era-processing activity', () => {
    expect(isEraProcessingProvenance(provenance('prov1', []))).toBe(true);
  });

  it('is false for any other activity', () => {
    expect(isEraProcessingProvenance(provenance('prov1', [], 'manual-era-import'))).toBe(false);
  });

  it('is false when there is no activity', () => {
    expect(isEraProcessingProvenance({})).toBe(false);
  });
});

describe('fetchClaimResponsesByPaymentReconciliations', () => {
  it("groups a payment reconciliation's ClaimResponses from its era-processing Provenance", async () => {
    const prov = provenance('prov1', [
      'PaymentReconciliation/payment-reconciliation-1',
      'ClaimResponse/cr1',
      'ClaimResponse/cr2',
    ]);
    const crs = [claimResponse('cr1'), claimResponse('cr2')];
    const { oystehr, search } = makeOystehr({
      Provenance: [prov],
      ClaimResponse: crs,
    });

    const grouped = await fetchClaimResponsesByPaymentReconciliations(oystehr, [
      makePaymentReconciliation('payment-reconciliation-1'),
    ]);

    expect(grouped.get('payment-reconciliation-1')).toEqual(crs);
    expect(searchParamFor(search, 'Provenance', 'target')).toBe('PaymentReconciliation/payment-reconciliation-1');
    expect(searchParamFor(search, 'ClaimResponse', '_id')).toBe('cr1,cr2');
  });

  it('ignores Provenances whose activity is not era-processing', async () => {
    const prov = provenance(
      'prov1',
      ['PaymentReconciliation/payment-reconciliation-1', 'ClaimResponse/cr1'],
      'manual-era-import'
    );
    const { oystehr, search } = makeOystehr({
      Provenance: [prov],
      ClaimResponse: [claimResponse('cr1')],
    });

    const grouped = await fetchClaimResponsesByPaymentReconciliations(oystehr, [
      makePaymentReconciliation('payment-reconciliation-1'),
    ]);

    expect(grouped.has('payment-reconciliation-1')).toBe(false);
    // no ClaimResponse ids to resolve, so only the Provenance search runs
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('leaves a payment reconciliation with no era-processing Provenance out of the map', async () => {
    const { oystehr } = makeOystehr({ Provenance: [] });

    const grouped = await fetchClaimResponsesByPaymentReconciliations(oystehr, [
      makePaymentReconciliation('payment-reconciliation-1'),
    ]);

    expect(grouped.has('payment-reconciliation-1')).toBe(false);
  });
});

describe('fetchClaimEraLinks', () => {
  it('resolves the payment reconciliation behind a ClaimResponse and maps it back, in a single Provenance fetch', async () => {
    const prov = provenance('prov1', ['PaymentReconciliation/payment-reconciliation-1', 'ClaimResponse/cr1']);
    const paymentReconciliation = makePaymentReconciliation('payment-reconciliation-1');
    const cr1 = claimResponse('cr1');
    const { oystehr, search } = makeOystehr({
      Provenance: [prov],
      PaymentReconciliation: [paymentReconciliation],
    });

    const { paymentReconciliations, paymentReconciliationIdByClaimResponseId } = await fetchClaimEraLinks(oystehr, [
      cr1,
    ]);

    expect(paymentReconciliations).toEqual([paymentReconciliation]);
    expect(paymentReconciliationIdByClaimResponseId.get('cr1')).toBe('payment-reconciliation-1');
    expect(searchParamFor(search, 'Provenance', 'target')).toBe('ClaimResponse/cr1');
    expect(searchParamFor(search, 'PaymentReconciliation', '_id')).toBe('payment-reconciliation-1');
    // one Provenance search (by CR ref) + one PaymentReconciliation search, no ClaimResponse re-fetch
    expect(search).toHaveBeenCalledTimes(2);
    expect(search.mock.calls.some((c) => (c[0] as { resourceType: string }).resourceType === 'ClaimResponse')).toBe(
      false
    );
  });

  it('dedupes the payment reconciliation and maps every ClaimResponse when several share one ERA Provenance', async () => {
    // e.g. a reversal and its correction arriving on the same ERA
    const prov = provenance('prov1', [
      'PaymentReconciliation/payment-reconciliation-1',
      'ClaimResponse/cr1',
      'ClaimResponse/cr2',
    ]);
    const paymentReconciliation = makePaymentReconciliation('payment-reconciliation-1');
    const { oystehr } = makeOystehr({
      Provenance: [prov],
      PaymentReconciliation: [paymentReconciliation],
    });

    const { paymentReconciliations, paymentReconciliationIdByClaimResponseId } = await fetchClaimEraLinks(oystehr, [
      claimResponse('cr1'),
      claimResponse('cr2'),
    ]);

    expect(paymentReconciliations).toEqual([paymentReconciliation]);
    expect(paymentReconciliationIdByClaimResponseId).toEqual(
      new Map([
        ['cr1', 'payment-reconciliation-1'],
        ['cr2', 'payment-reconciliation-1'],
      ])
    );
  });

  it('maps ClaimResponses on different ERAs to their own payment reconciliation, skipping ones it was not asked about', async () => {
    const provenances = [
      provenance('prov1', [
        'PaymentReconciliation/payment-reconciliation-1',
        'ClaimResponse/cr1',
        'ClaimResponse/other-claim-cr',
      ]),
      provenance('prov2', ['PaymentReconciliation/payment-reconciliation-2', 'ClaimResponse/cr2']),
    ];
    const { oystehr } = makeOystehr({
      Provenance: provenances,
      PaymentReconciliation: [
        makePaymentReconciliation('payment-reconciliation-1'),
        makePaymentReconciliation('payment-reconciliation-2'),
      ],
    });

    const { paymentReconciliationIdByClaimResponseId } = await fetchClaimEraLinks(oystehr, [
      claimResponse('cr1'),
      claimResponse('cr2'),
    ]);

    expect(paymentReconciliationIdByClaimResponseId).toEqual(
      new Map([
        ['cr1', 'payment-reconciliation-1'],
        ['cr2', 'payment-reconciliation-2'],
      ])
    );
  });

  it('returns nothing when no era-processing Provenance is found', async () => {
    const { oystehr, search } = makeOystehr({ Provenance: [] });

    const { paymentReconciliations, paymentReconciliationIdByClaimResponseId } = await fetchClaimEraLinks(oystehr, [
      claimResponse('cr1'),
    ]);

    expect(paymentReconciliations).toEqual([]);
    expect(paymentReconciliationIdByClaimResponseId.size).toBe(0);
    // no payment reconciliation ids to resolve, so only the Provenance search runs
    expect(search).toHaveBeenCalledTimes(1);
  });
});
