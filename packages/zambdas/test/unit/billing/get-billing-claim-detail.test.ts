import Oystehr from '@oystehr/sdk';
import { Claim, Patient, PaymentNotice } from 'fhir/r4b';
import { PAYMENT_METHOD_EXTENSION_URL } from 'utils';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { fetchClaimEraLinks, fetchClaimResponsesByClaimIds } from '../../../src/billing/claim-amounts';
import { performEffect } from '../../../src/billing/get-billing-claim-detail';
import { fetchClaimGraph, resolvePayersByRef } from '../../../src/billing/shared';

// src/billing/shared and src/billing/claim-amounts are mocked suite-wide in
// vitest.unit-mocks.setup.ts; behaviors are installed in beforeEach below.

const CLAIM_ENC_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');

const claim = {
  resourceType: 'Claim',
  id: 'claim-1',
  status: 'active',
  created: '2026-07-01',
  type: {
    coding: [],
  },
  identifier: [
    {
      system: CLAIM_ENC_SYSTEM,
      value: 'enc-1',
    },
  ],
  total: {
    value: 200,
    currency: 'USD',
  },
  insurance: [],
  diagnosis: [],
  item: [],
  meta: {
    tag: [],
  },
} as unknown as Claim;

const patient = {
  resourceType: 'Patient',
  id: 'pat-1',
  name: [
    {
      family: 'Doe',
      given: ['Jane'],
    },
  ],
  birthDate: '1990-01-01',
  address: [],
} as unknown as Patient;

const paymentNotice = (opts: {
  id: string;
  amount: number;
  paymentDate: string;
  method?: string;
  status?: PaymentNotice['status'];
}): PaymentNotice => {
  const { id, amount, paymentDate, method = 'cash', status = 'active' } = opts;
  return {
    resourceType: 'PaymentNotice',
    id,
    status,
    created: `${paymentDate}T12:00:00Z`,
    paymentDate,
    amount: {
      value: amount,
      currency: 'USD',
    },
    request: {
      type: 'Claim',
      identifier: {
        system: CLAIM_ENC_SYSTEM,
        value: 'enc-1',
      },
    },
    extension: [
      {
        url: PAYMENT_METHOD_EXTENSION_URL,
        valueString: method,
      },
    ],
    contained: [
      {
        resourceType: 'PaymentReconciliation',
        id: 'contained-reconciliation',
        status: 'active',
        created: `${paymentDate}T12:00:00Z`,
        paymentDate,
        paymentAmount: {
          value: amount,
          currency: 'USD',
        },
        disposition: `${method} collected from patient`,
      },
    ],
  } as PaymentNotice;
};

const makeBillingClient = (notices: PaymentNotice[]): Oystehr => {
  const search = vi.fn().mockImplementation(({ resourceType }: { resourceType: string }) =>
    Promise.resolve({
      unbundle: () => (resourceType === 'PaymentNotice' ? notices : []),
      link: [],
    })
  );
  const batch = vi.fn().mockResolvedValue({
    resourceType: 'Bundle',
    entry: [],
  });
  return {
    fhir: {
      search,
      batch,
    },
  } as unknown as Oystehr;
};

describe('get-billing-claim-detail performEffect: patient payments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchClaimGraph as Mock).mockResolvedValue({
      claim,
      patient,
      billingProvider: undefined,
      serviceFacility: undefined,
      renderingProvider: undefined,
      coverages: [],
      subscribers: [],
    });
    (resolvePayersByRef as Mock).mockResolvedValue(new Map());
    (fetchClaimResponsesByClaimIds as Mock).mockResolvedValue(new Map());
    (fetchClaimEraLinks as Mock).mockResolvedValue({
      paymentReconciliations: [],
      claimResponseByPrId: new Map(),
    });
  });

  it('sums patient payments into patientPaid, nets the balance, and lists them newest-first', async () => {
    const notices = [
      paymentNotice({
        id: 'pn-old',
        amount: 30,
        paymentDate: '2026-07-01',
      }),
      paymentNotice({
        id: 'pn-new',
        amount: 60,
        paymentDate: '2026-07-10',
        method: 'check',
      }),
    ];
    const oystehr = makeBillingClient(notices);

    const response = await performEffect(
      oystehr,
      {} as unknown as Oystehr,
      {
        claimId: 'claim-1',
        secrets: {},
      } as never
    );

    expect(response.patientPaid).toBe(90);
    // no ERA yet, so the claim is un-adjudicated
    expect(response.adjudicated).toBe(false);
    expect(response.balance).toBe(110);
    expect(response.patientPayments.map((p) => p.paymentNoticeId)).toEqual(['pn-new', 'pn-old']);
    expect(response.patientPayments[0]).toMatchObject({
      amount: 60,
      method: 'check',
      paymentDate: '2026-07-10',
    });
  });

  it('returns an empty list and zero patientPaid when no payments are linked', async () => {
    const oystehr = makeBillingClient([]);

    const response = await performEffect(
      oystehr,
      {} as unknown as Oystehr,
      {
        claimId: 'claim-1',
        secrets: {},
      } as never
    );

    expect(response.patientPaid).toBe(0);
    expect(response.balance).toBe(200);
    expect(response.patientPayments).toEqual([]);
  });

  it('lists a cancelled refund for the audit trail but keeps it out of patientPaid and the balance', async () => {
    const notices = [
      paymentNotice({
        id: 'pn-charge',
        amount: 100,
        paymentDate: '2026-07-01',
        method: 'card',
      }),
      paymentNotice({
        id: 'pn-refund-failed',
        amount: -40,
        paymentDate: '2026-07-12',
        method: 'card',
        status: 'cancelled',
      }),
    ];
    const oystehr = makeBillingClient(notices);

    const response = await performEffect(
      oystehr,
      {} as unknown as Oystehr,
      {
        claimId: 'claim-1',
        secrets: {},
      } as never
    );

    expect(response.patientPaid).toBe(100);
    expect(response.balance).toBe(100);
    expect(response.patientPayments.map((p) => p.paymentNoticeId)).toEqual(['pn-refund-failed', 'pn-charge']);
    expect(response.patientPayments[0].status).toBe('cancelled');
  });
});
