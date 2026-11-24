import Oystehr, { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { DocumentReference, FhirResource, Invoice, PaymentNotice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  buildBillingInvoice,
  getNioInvoicePaymentId,
  getPaymentNoticeInvoiceId,
  INVOICE_NUMBER_IDENTIFIER_SYSTEM,
  INVOICE_PAYMENT_TAG_SYSTEM,
  invoicePaymentExtension,
  invoicePaymentTag,
  NIO_INVOICE_PAYMENT_ID_SYSTEM,
  PAYMENT_REFERENCE_IDENTIFIER_SYSTEM,
} from 'utils/lib/fhir/billing-invoice';
import { INVALID_INPUT_ERROR, MANUAL_PAYMENT_CONFLICT_ERROR } from 'utils/lib/types/errors';
import { describe, expect, it, vi } from 'vitest';
import { buildPaymentNotice } from '../../../src/billing/payments';
import { performEffect } from '../../../src/billing/record-billing-nio-invoice-payment';

vi.mock('../../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

const INVOICE_ID = 'invoice-1';
const PAYMENT_ID = 'payment-key-1';
const NOW = DateTime.fromISO('2026-11-19T15:00:00.000Z');
const agent = {
  who: {
    reference: 'Practitioner/biller-1',
  },
};

const nioInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  ...buildBillingInvoice({
    status: 'issued',
    date: '2026-11-01T15:00:00.000Z',
    dueDate: '2026-11-30',
    issuer: {
      reference: 'Organization/issuer-1',
    },
    recipient: {
      reference: 'Organization/nio-1',
    },
    claims: [
      {
        claimId: 'claim-1',
        amountCents: 18000,
      },
      {
        claimId: 'claim-2',
        amountCents: 14000,
      },
    ],
  }),
  id: INVOICE_ID,
  meta: {
    versionId: '3',
  },
  identifier: [
    {
      system: INVOICE_NUMBER_IDENTIFIER_SYSTEM,
      value: 'INV-00042',
    },
  ],
  ...overrides,
});

const existingPayment = (paymentId: string, amount: number): PaymentNotice => ({
  resourceType: 'PaymentNotice',
  id: `notice-${paymentId}`,
  status: 'active',
  created: '2026-11-10',
  payment: {},
  recipient: {},
  amount: {
    value: amount,
    currency: 'USD',
  },
  identifier: [
    {
      system: NIO_INVOICE_PAYMENT_ID_SYSTEM,
      value: paymentId,
    },
  ],
  meta: {
    tag: [invoicePaymentTag(INVOICE_ID)],
  },
  extension: [invoicePaymentExtension(INVOICE_ID)],
});

const recordedPaymentNotice = ({
  claimId,
  amountInCents,
}: {
  claimId: string;
  amountInCents: number;
}): PaymentNotice => ({
  ...buildPaymentNotice({
    request: {
      reference: `Claim/${claimId}`,
    },
    payee: {
      reference: 'Organization/issuer-1',
    },
    amountInCents,
    paymentMethod: 'check',
    identifier: {
      system: NIO_INVOICE_PAYMENT_ID_SYSTEM,
      value: PAYMENT_ID,
    },
    paymentDate: '2026-11-18',
    createdISO: '2026-11-19T15:00:00.000Z',
    disposition: 'Payment toward invoice INV-00042',
    reconciliation: {
      identifier: [
        {
          system: PAYMENT_REFERENCE_IDENTIFIER_SYSTEM,
          value: '88123',
        },
      ],
    },
    invoiceId: INVOICE_ID,
  }),
  id: `notice-${claimId}`,
});

const recordedPayment = (): PaymentNotice[] => [
  recordedPaymentNotice({
    claimId: 'claim-1',
    amountInCents: 18000,
  }),
  recordedPaymentNotice({
    claimId: 'claim-2',
    amountInCents: 14000,
  }),
];

const setup = ({
  invoice = nioInvoice(),
  notices = [],
}: {
  invoice?: Invoice;
  notices?: PaymentNotice[];
} = {}): {
  oystehr: Oystehr;
  search: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
  resultsByType: Record<string, unknown[]>;
} => {
  const resultsByType: Record<string, unknown[]> = {
    Invoice: [invoice],
    PaymentNotice: notices,
  };
  const search = vi.fn(async ({ resourceType }: { resourceType: string }) => ({
    unbundle: () => resultsByType[resourceType],
  }));
  const transaction = vi.fn(async () => ({
    unbundle: () => [],
  }));
  return {
    oystehr: {
      fhir: {
        search,
        transaction,
      },
    } as unknown as Oystehr,
    search,
    transaction,
    resultsByType,
  };
};

const VERSION_CONFLICT = {
  code: 412,
};

const params = {
  invoiceId: INVOICE_ID,
  amountInCents: 32000,
  paymentMethod: 'check' as const,
  paymentDate: '2026-11-18',
  reference: '88123',
  idempotencyKey: PAYMENT_ID,
  secrets: {},
  agent,
};

const writtenRequests = (transaction: ReturnType<typeof vi.fn>): BatchInputRequest<FhirResource>[] =>
  transaction.mock.calls[0][0].requests;

const writtenNotices = (transaction: ReturnType<typeof vi.fn>): PaymentNotice[] =>
  writtenRequests(transaction)
    .filter(
      (request): request is BatchInputPostRequest<PaymentNotice> =>
        request.method === 'POST' && request.url === '/PaymentNotice'
    )
    .map((request) => request.resource);

describe('record-billing-nio-invoice-payment', () => {
  it('pays each claim its invoiced share, under one payment id, and balances the invoice it read', async () => {
    const { oystehr, transaction } = setup();

    const result = await performEffect({
      oystehr,
      params,
      now: NOW,
    });

    expect(result).toEqual({
      paymentId: PAYMENT_ID,
    });
    const [invoicePatch] = writtenRequests(transaction);
    expect(invoicePatch).toMatchObject({
      method: 'PATCH',
      url: `/Invoice/${INVOICE_ID}`,
      ifMatch: 'W/"3"',
    });
    const notices = writtenNotices(transaction);
    expect(notices.map((notice) => [notice.request?.reference, notice.amount.value])).toEqual([
      ['Claim/claim-1', 180],
      ['Claim/claim-2', 140],
    ]);
    for (const notice of notices) {
      expect(getNioInvoicePaymentId(notice)).toBe(PAYMENT_ID);
      expect(getPaymentNoticeInvoiceId(notice)).toBe(INVOICE_ID);
      expect(notice.meta?.tag).toContainEqual({
        system: INVOICE_PAYMENT_TAG_SYSTEM,
        code: INVOICE_ID,
      });
      expect(notice.payee).toEqual({
        reference: 'Organization/issuer-1',
      });
      expect(notice.paymentDate).toBe('2026-11-18');
      expect(notice.contained?.[0]).toMatchObject({
        identifier: [
          {
            system: PAYMENT_REFERENCE_IDENTIFIER_SYSTEM,
            value: '88123',
          },
        ],
      });
    }
  });

  it("records each claim's payment in that claim's history, attributed to the biller", async () => {
    const { oystehr, transaction } = setup();

    await performEffect({
      oystehr,
      params,
      now: NOW,
    });

    const provenances = writtenRequests(transaction).filter(
      (request) => request.method === 'POST' && request.url === '/Provenance'
    );
    expect(provenances).toHaveLength(2);
    expect(JSON.stringify(provenances)).toContain('Practitioner/biller-1');
  });

  it('saves the uploaded attachment with the payment', async () => {
    const { oystehr, transaction } = setup();

    await performEffect({
      oystehr,
      params: {
        ...params,
        attachment: {
          path: `invoice-attachments/${INVOICE_ID}/abc-check.pdf`,
          fileName: 'check.pdf',
        },
        secrets: {
          PROJECT_API: 'https://project-api.test',
          PROJECT_ID: 'project-1',
        },
      },
      now: NOW,
    });

    const [documentReference] = writtenRequests(transaction)
      .filter(
        (request): request is BatchInputPostRequest<DocumentReference> =>
          request.method === 'POST' && request.url === '/DocumentReference'
      )
      .map((request) => request.resource);
    const [firstNotice] = writtenRequests(transaction).filter(
      (request): request is BatchInputPostRequest<PaymentNotice> =>
        request.method === 'POST' && request.url === '/PaymentNotice'
    );
    expect(getNioInvoicePaymentId(documentReference)).toBe(PAYMENT_ID);
    expect(documentReference.context?.related).toEqual([
      {
        reference: firstNotice.fullUrl,
      },
    ]);
  });

  it('returns the payment without writing again when the same payment is resent', async () => {
    const { oystehr, transaction } = setup({
      invoice: nioInvoice({
        status: 'balanced',
      }),
      notices: recordedPayment(),
    });

    const result = await performEffect({
      oystehr,
      params,
      now: NOW,
    });

    expect(result).toEqual({
      paymentId: PAYMENT_ID,
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('refuses a resent payment whose details differ from the one recorded under its key', async () => {
    const changes = [
      {
        amountInCents: 18000,
      },
      {
        paymentMethod: 'wire' as const,
      },
      {
        paymentDate: '2026-11-17',
      },
      {
        reference: '99999',
      },
    ];

    for (const change of changes) {
      const { oystehr, transaction } = setup({
        invoice: nioInvoice({
          status: 'balanced',
        }),
        notices: recordedPayment(),
      });

      await expect(
        performEffect({
          oystehr,
          params: {
            ...params,
            ...change,
          },
          now: NOW,
        })
      ).rejects.toEqual(MANUAL_PAYMENT_CONFLICT_ERROR(PAYMENT_ID));
      expect(transaction).not.toHaveBeenCalled();
    }
  });

  it('refuses an amount other than the balance', async () => {
    const { oystehr, transaction } = setup();

    await expect(
      performEffect({
        oystehr,
        params: {
          ...params,
          amountInCents: 18000,
        },
        now: NOW,
      })
    ).rejects.toEqual(INVALID_INPUT_ERROR('The payment must be the invoice balance of $320.00'));
    expect(transaction).not.toHaveBeenCalled();
  });

  it('refuses an invoice that is not issued', async () => {
    const { oystehr } = setup({
      invoice: nioInvoice({
        status: 'cancelled',
      }),
    });

    await expect(
      performEffect({
        oystehr,
        params,
        now: NOW,
      })
    ).rejects.toEqual(INVALID_INPUT_ERROR("Invoice INV-00042 is cancelled, so it can't take a payment"));
  });

  it('refuses an invoice that already has a payment toward it', async () => {
    const { oystehr } = setup({
      notices: [existingPayment('other-payment', 100)],
    });

    await expect(
      performEffect({
        oystehr,
        params: {
          ...params,
          amountInCents: 22000,
        },
        now: NOW,
      })
    ).rejects.toEqual(
      INVALID_INPUT_ERROR('Invoice INV-00042 already has a payment, and only full payments can be recorded')
    );
  });

  it('refuses a patient invoice', async () => {
    const { oystehr } = setup({
      invoice: nioInvoice({
        recipient: {
          reference: 'Patient/pat-1',
        },
      }),
    });

    await expect(
      performEffect({
        oystehr,
        params,
        now: NOW,
      })
    ).rejects.toEqual(INVALID_INPUT_ERROR('Only non-insurance payer invoices take recorded payments'));
  });

  it('returns without writing again when another writer records the same payment first', async () => {
    const { oystehr, transaction, resultsByType } = setup();
    transaction.mockImplementationOnce(async () => {
      resultsByType.PaymentNotice = [existingPayment(PAYMENT_ID, 180), existingPayment(PAYMENT_ID, 140)];
      throw VERSION_CONFLICT;
    });

    const result = await performEffect({
      oystehr,
      params,
      now: NOW,
    });

    expect(result).toEqual({
      paymentId: PAYMENT_ID,
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('writes against the current invoice version when the invoice changed under it', async () => {
    const { oystehr, transaction, resultsByType } = setup();
    transaction.mockImplementationOnce(async () => {
      resultsByType.Invoice = [
        nioInvoice({
          meta: {
            versionId: '4',
          },
        }),
      ];
      throw VERSION_CONFLICT;
    });

    await performEffect({
      oystehr,
      params,
      now: NOW,
    });

    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction.mock.calls[1][0].requests[0]).toMatchObject({
      ifMatch: 'W/"4"',
    });
  });

  it('refuses when a different payment balanced the invoice first', async () => {
    const { oystehr, transaction, resultsByType } = setup();
    transaction.mockImplementationOnce(async () => {
      resultsByType.Invoice = [
        nioInvoice({
          status: 'balanced',
        }),
      ];
      resultsByType.PaymentNotice = [existingPayment('other-payment', 320)];
      throw VERSION_CONFLICT;
    });

    await expect(
      performEffect({
        oystehr,
        params,
        now: NOW,
      })
    ).rejects.toEqual(INVALID_INPUT_ERROR("Invoice INV-00042 is balanced, so it can't take a payment"));
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
