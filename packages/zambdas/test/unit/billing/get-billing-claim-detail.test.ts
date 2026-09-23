import Oystehr from '@oystehr/sdk';
import { Claim, Organization, Patient, PaymentNotice, PaymentReconciliation } from 'fhir/r4b';
import { PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import {
  fetchClaimEraLinks,
  fetchClaimFirstSubmittedDate,
  fetchClaimResponsesByClaimIds,
} from '../../../src/billing/claim-amounts';
import { performEffect } from '../../../src/billing/get-billing-claim-detail';
import { ERA_CHECK_SYSTEM, fetchClaimGraph, resolvePayersByRef } from '../../../src/billing/shared';
import { adjudication, casAdjustment, claimResponse, eraItem } from './era-fixtures';

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchClaimGraph: vi.fn(),
  resolvePayersByRef: vi.fn(),
}));

vi.mock('../../../src/billing/claim-amounts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchClaimResponsesByClaimIds: vi.fn(),
  fetchClaimEraLinks: vi.fn(),
  fetchClaimFirstSubmittedDate: vi.fn(),
}));

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
    (fetchClaimGraph as Mock<typeof fetchClaimGraph>).mockResolvedValue({
      claim,
      patient,
      billingProvider: undefined,
      serviceFacility: undefined,
      renderingProvider: undefined,
      coverages: [],
      subscribers: [],
      documentReferences: [],
    });
    (resolvePayersByRef as Mock<typeof resolvePayersByRef>).mockResolvedValue(new Map());
    (fetchClaimResponsesByClaimIds as Mock<typeof fetchClaimResponsesByClaimIds>).mockResolvedValue(new Map());
    (fetchClaimEraLinks as Mock<typeof fetchClaimEraLinks>).mockResolvedValue({
      paymentReconciliations: [],
      prIdByClaimResponseId: new Map(),
    });
    (fetchClaimFirstSubmittedDate as Mock<typeof fetchClaimFirstSubmittedDate>).mockResolvedValue('');
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

describe('get-billing-claim-detail performEffect: remits and insurance payments', () => {
  const PAYER_REF = 'https://rcm-api.zapehr.com/v1/payer/acme';

  const claimWithItems = {
    ...claim,
    item: [
      {
        sequence: 1,
        productOrService: {
          coding: [{ code: '99213' }],
        },
        servicedDate: '2026-07-01',
        net: { value: 150, currency: 'USD' },
      },
      {
        sequence: 2,
        productOrService: {
          coding: [{ code: '81002' }],
        },
        servicedDate: '2026-07-01',
        net: { value: 50, currency: 'USD' },
      },
    ],
  } as unknown as Claim;

  // the ERA the first remit arrived on; process-era PaymentReconciliations carry no paymentIssuer
  const era: PaymentReconciliation = {
    resourceType: 'PaymentReconciliation',
    id: 'pr-1',
    status: 'active',
    created: '2026-07-14T10:00:00Z',
    paymentDate: '2026-07-16',
    identifier: [{ system: ERA_CHECK_SYSTEM, value: 'CHK-1' }],
    paymentAmount: { value: 500, currency: 'USD' },
  };

  const linkedRemit = claimResponse({
    id: 'cr-linked',
    created: '2026-07-15',
    request: { reference: 'Claim/claim-1' },
    insurer: { reference: PAYER_REF },
    item: [
      eraItem({
        sequence: 1,
        procedureCode: '99213',
        adjudication: [
          adjudication('charge', 150),
          adjudication('allowed', 100),
          adjudication('paid', 80),
          casAdjustment('CO', 50, '45'),
          casAdjustment('PR', 20, '3'),
        ],
      }),
    ],
    // the process-era converter's bucket for claim-level CAS adjustments
    addItem: [
      {
        productOrService: { coding: [{ code: 'unknown' }] },
        adjudication: [casAdjustment('OA', 5, '23')],
      },
    ],
  });

  const unlinkedRemit = claimResponse({
    id: 'cr-unlinked',
    created: '2026-07-20',
    request: { reference: 'Claim/claim-1' },
    item: [
      eraItem({
        sequence: 2,
        procedureCode: '81002',
        adjudication: [adjudication('paid', 40)],
      }),
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (fetchClaimGraph as Mock<typeof fetchClaimGraph>).mockResolvedValue({
      claim: claimWithItems,
      patient,
      billingProvider: undefined,
      serviceFacility: undefined,
      renderingProvider: undefined,
      coverages: [],
      subscribers: [],
      documentReferences: [],
    });
    (resolvePayersByRef as Mock<typeof resolvePayersByRef>).mockResolvedValue(
      new Map([[PAYER_REF, { resourceType: 'Organization', id: 'org-acme', name: 'Acme Health' } as Organization]])
    );
    (fetchClaimResponsesByClaimIds as Mock<typeof fetchClaimResponsesByClaimIds>).mockResolvedValue(
      new Map([['claim-1', [unlinkedRemit, linkedRemit]]])
    );
    (fetchClaimEraLinks as Mock<typeof fetchClaimEraLinks>).mockResolvedValue({
      paymentReconciliations: [era],
      prIdByClaimResponseId: new Map([['cr-linked', 'pr-1']]),
    });
    (fetchClaimFirstSubmittedDate as Mock<typeof fetchClaimFirstSubmittedDate>).mockResolvedValue(
      '2026-07-02T12:00:00Z'
    );
  });

  const run = (): ReturnType<typeof performEffect> =>
    performEffect(
      makeBillingClient([]),
      {} as unknown as Oystehr,
      {
        claimId: 'claim-1',
        secrets: {},
      } as never
    );

  it('carries the ERA and check behind each remit, newest remit first', async () => {
    const response = await run();

    expect(response.remits.map((remit) => remit.claimResponseId)).toEqual(['cr-unlinked', 'cr-linked']);
    expect(response.remits[1]).toMatchObject({
      paymentReconciliationId: 'pr-1',
      checkNumber: 'CHK-1',
      checkDate: '2026-07-16',
      payerName: 'Acme Health',
    });
    // no era-processing Provenance links this one to an ERA
    expect(response.remits[0]).toMatchObject({
      paymentReconciliationId: '',
      checkNumber: '',
      checkDate: '',
    });
  });

  it("joins each remit's adjudicated lines to the claim's service lines", async () => {
    const response = await run();

    const [line, claimLevel] = response.remits[1].serviceLines;
    expect(line).toMatchObject({
      claimItemSequence: 1,
      isClaimLevel: false,
      cptCode: '99213',
      billed: 150,
      allowed: 100,
      paid: 80,
      copay: 20,
      adjustments: [
        { groupCode: 'CO', reasonCode: '45', amount: 50 },
        { groupCode: 'PR', reasonCode: '3', amount: 20 },
      ],
    });
    expect(claimLevel).toMatchObject({
      claimItemSequence: null,
      isClaimLevel: true,
      adjustments: [{ groupCode: 'OA', reasonCode: '23', amount: 5 }],
    });
    expect(response.remits[0].serviceLines).toEqual([expect.objectContaining({ claimItemSequence: 2, paid: 40 })]);
  });

  it('dates each insurance payment by remit and check, naming the payer from its remit', async () => {
    const response = await run();

    expect(response.insurancePayments).toEqual([
      {
        paymentReconciliationId: 'pr-1',
        checkNumber: 'CHK-1',
        remitDate: '2026-07-14T10:00:00Z',
        checkDate: '2026-07-16',
        paymentAmount: 500,
        payerName: 'Acme Health',
        status: 'active',
      },
    ]);
  });

  it('reports when the claim was first submitted', async () => {
    const response = await run();

    expect(response.firstSubmittedDate).toBe('2026-07-02T12:00:00Z');
    expect(fetchClaimFirstSubmittedDate).toHaveBeenCalledWith(expect.anything(), 'claim-1');
  });
});
