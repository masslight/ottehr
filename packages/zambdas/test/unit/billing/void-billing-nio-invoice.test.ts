import Oystehr from '@oystehr/sdk';
import { Invoice, PaymentNotice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  buildBillingInvoice,
  INVOICE_NUMBER_IDENTIFIER_SYSTEM,
  invoiceExtensionsWithCardPaymentReservation,
  invoicePaymentExtension,
  invoicePaymentTag,
} from 'utils/lib/fhir/billing-invoice';
import { BILLING_INVOICE_CONFLICT_ERROR, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settleOtherCardReservation } from '../../../src/billing/invoice-card-reservation';
import { cardPaymentInProgressError } from '../../../src/billing/invoice-payments';
import { performEffect } from '../../../src/billing/void-billing-nio-invoice';

vi.mock('../../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock('../../../src/billing/invoice-card-reservation', () => ({
  settleOtherCardReservation: vi.fn(),
}));

const INVOICE_ID = 'invoice-1';
const NOW = DateTime.fromISO('2026-11-23T15:00:00.000Z');

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
        amountCents: 32000,
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

const reservedInvoice = (): Invoice =>
  nioInvoice({
    extension: invoiceExtensionsWithCardPaymentReservation(nioInvoice(), {
      paymentId: 'card-payment-1',
      reservedAt: '2026-11-23T14:59:00.000Z',
      renewedAt: '2026-11-23T14:59:00.000Z',
    }),
  });

const payment: PaymentNotice = {
  resourceType: 'PaymentNotice',
  id: 'notice-1',
  status: 'active',
  created: '2026-11-10',
  payment: {},
  recipient: {},
  amount: {
    value: 100,
    currency: 'USD',
  },
  meta: {
    tag: [invoicePaymentTag(INVOICE_ID)],
  },
  extension: [invoicePaymentExtension(INVOICE_ID)],
};

const VERSION_CONFLICT = Object.assign(new Error('Precondition failed'), {
  code: 412,
});

interface InvoiceRead {
  invoice: Invoice;
  notices?: PaymentNotice[];
}

// Each read of the invoice returns the next entry, so a re-read after a conflict sees a later state.
const setup = ({
  reads = [
    {
      invoice: nioInvoice(),
    },
  ],
  transactionError,
}: {
  reads?: InvoiceRead[];
  transactionError?: Error;
} = {}): {
  oystehr: Oystehr;
  transaction: ReturnType<typeof vi.fn>;
} => {
  const invoiceReads = reads.map(({ invoice }) => invoice);
  const noticeReads = reads.map(({ notices }) => notices ?? []);
  const search = vi.fn(async ({ resourceType }: { resourceType: string }) => {
    const results = resourceType === 'Invoice' ? [invoiceReads.shift()] : noticeReads.shift();
    return {
      unbundle: () => results,
    };
  });
  const transaction = vi.fn(async () => {
    if (transactionError) throw transactionError;
    return {
      unbundle: () => [],
    };
  });
  return {
    oystehr: {
      fhir: {
        search,
        transaction,
      },
    } as unknown as Oystehr,
    transaction,
  };
};

const params = {
  invoiceId: INVOICE_ID,
  reason: 'Billed the wrong payer',
  secrets: {},
  agent: {
    who: {
      reference: 'Practitioner/biller-1',
    },
  },
};

const getStripe = (): Stripe => ({}) as Stripe;

const voidInvoice = (oystehr: Oystehr): ReturnType<typeof performEffect> =>
  performEffect({
    oystehr,
    getStripe,
    params,
    now: NOW,
  });

describe('void-billing-nio-invoice', () => {
  beforeEach(() => {
    vi.mocked(settleOtherCardReservation).mockReset();
  });

  it('cancels the invoice it read, with the reason', async () => {
    const { oystehr, transaction } = setup();

    const result = await voidInvoice(oystehr);

    expect(result).toEqual({
      ok: true,
    });
    const [patch] = transaction.mock.calls[0][0].requests;
    expect(patch).toMatchObject({
      method: 'PATCH',
      url: `/Invoice/${INVOICE_ID}`,
      ifMatch: 'W/"3"',
    });
    expect(JSON.parse(atob(patch.resource.data))).toEqual([
      {
        op: 'replace',
        path: '/status',
        value: 'cancelled',
      },
      {
        op: 'add',
        path: '/cancelledReason',
        value: 'Billed the wrong payer',
      },
    ]);
  });

  it('records who voided the invoice and when', async () => {
    const { oystehr, transaction } = setup();

    await voidInvoice(oystehr);

    const [, provenance] = transaction.mock.calls[0][0].requests;
    expect(provenance).toMatchObject({
      method: 'POST',
      url: '/Provenance',
      resource: {
        target: [
          {
            reference: `Invoice/${INVOICE_ID}`,
          },
        ],
        recorded: '2026-11-23T15:00:00.000Z',
        activity: {
          coding: [
            {
              code: 'invoice-void',
            },
          ],
        },
        agent: [params.agent],
      },
    });
  });

  it('writes nothing for an invoice that is already void', async () => {
    const { oystehr, transaction } = setup({
      reads: [
        {
          invoice: nioInvoice({
            status: 'cancelled',
          }),
        },
      ],
    });

    await expect(voidInvoice(oystehr)).resolves.toEqual({
      ok: true,
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('refuses a paid invoice', async () => {
    const { oystehr, transaction } = setup({
      reads: [
        {
          invoice: nioInvoice({
            status: 'balanced',
          }),
        },
      ],
    });

    await expect(voidInvoice(oystehr)).rejects.toEqual(
      INVALID_INPUT_ERROR("Invoice INV-00042 is balanced, so it can't be voided")
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('refuses an open invoice that already has a payment', async () => {
    const { oystehr, transaction } = setup({
      reads: [
        {
          invoice: nioInvoice(),
          notices: [payment],
        },
      ],
    });

    await expect(voidInvoice(oystehr)).rejects.toEqual(
      INVALID_INPUT_ERROR("Invoice INV-00042 has a payment, so it can't be voided")
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('leaves Stripe alone when no card payment is reserved', async () => {
    const { oystehr } = setup();

    await voidInvoice(oystehr);

    expect(settleOtherCardReservation).not.toHaveBeenCalled();
  });

  it('refuses while a card payment is still charging', async () => {
    const { oystehr, transaction } = setup({
      reads: [
        {
          invoice: reservedInvoice(),
        },
      ],
    });
    vi.mocked(settleOtherCardReservation).mockRejectedValue(cardPaymentInProgressError(reservedInvoice()));

    await expect(voidInvoice(oystehr)).rejects.toEqual(cardPaymentInProgressError(reservedInvoice()));
    expect(settleOtherCardReservation).toHaveBeenCalledWith({
      oystehr,
      getStripe,
      invoiceId: INVOICE_ID,
      agent: params.agent,
      secrets: params.secrets,
      now: NOW,
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('refuses when the reserved card payment went through', async () => {
    const { oystehr, transaction } = setup({
      reads: [
        {
          invoice: reservedInvoice(),
        },
        {
          invoice: nioInvoice({
            status: 'balanced',
          }),
        },
      ],
    });

    await expect(voidInvoice(oystehr)).rejects.toEqual(
      INVALID_INPUT_ERROR("Invoice INV-00042 is balanced, so it can't be voided")
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('voids once a card payment that never charged is released', async () => {
    const { oystehr, transaction } = setup({
      reads: [
        {
          invoice: reservedInvoice(),
        },
        {
          invoice: nioInvoice(),
        },
      ],
    });

    await expect(voidInvoice(oystehr)).resolves.toEqual({
      ok: true,
    });
    expect(transaction).toHaveBeenCalled();
  });

  it('succeeds when another void landed while the reservation was settled', async () => {
    const { oystehr, transaction } = setup({
      reads: [
        {
          invoice: reservedInvoice(),
        },
        {
          invoice: nioInvoice({
            status: 'cancelled',
          }),
        },
      ],
    });

    await expect(voidInvoice(oystehr)).resolves.toEqual({
      ok: true,
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('refuses when a card payment is reserved after the reservation was settled', async () => {
    const { oystehr, transaction } = setup({
      reads: [
        {
          invoice: reservedInvoice(),
        },
        {
          invoice: reservedInvoice(),
        },
      ],
    });

    await expect(voidInvoice(oystehr)).rejects.toEqual(cardPaymentInProgressError(reservedInvoice()));
    expect(transaction).not.toHaveBeenCalled();
  });

  it('refuses a patient invoice', async () => {
    const { oystehr } = setup({
      reads: [
        {
          invoice: nioInvoice({
            recipient: {
              reference: 'Patient/patient-1',
            },
          }),
        },
      ],
    });

    await expect(voidInvoice(oystehr)).rejects.toEqual(
      INVALID_INPUT_ERROR('Only non-insurance payer invoices can be voided')
    );
  });

  it('refuses the void when a payment balanced the invoice after it was read', async () => {
    const { oystehr } = setup({
      reads: [
        {
          invoice: nioInvoice(),
        },
        {
          invoice: nioInvoice({
            status: 'balanced',
          }),
        },
      ],
      transactionError: VERSION_CONFLICT,
    });

    await expect(voidInvoice(oystehr)).rejects.toEqual(
      INVALID_INPUT_ERROR("Invoice INV-00042 is balanced, so it can't be voided")
    );
  });

  it('asks for a retry when the invoice changed after it was read but can still be voided', async () => {
    const { oystehr } = setup({
      reads: [
        {
          invoice: nioInvoice(),
        },
        {
          invoice: nioInvoice(),
        },
      ],
      transactionError: VERSION_CONFLICT,
    });

    await expect(voidInvoice(oystehr)).rejects.toEqual(
      BILLING_INVOICE_CONFLICT_ERROR(
        'Invoice INV-00042 changed while it was being voided. Reload the page and try again.'
      )
    );
  });

  it('succeeds when another void landed after the invoice was read', async () => {
    const { oystehr } = setup({
      reads: [
        {
          invoice: nioInvoice(),
        },
        {
          invoice: nioInvoice({
            status: 'cancelled',
          }),
        },
      ],
      transactionError: VERSION_CONFLICT,
    });

    await expect(voidInvoice(oystehr)).resolves.toEqual({
      ok: true,
    });
  });
});
