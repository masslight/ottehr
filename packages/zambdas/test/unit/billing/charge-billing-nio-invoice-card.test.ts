import Oystehr, { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { FhirResource, Invoice, Organization, PaymentNotice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  buildBillingInvoice,
  getInvoiceCardPaymentReservation,
  getNioInvoicePaymentId,
  INVOICE_NUMBER_IDENTIFIER_SYSTEM,
  InvoiceCardPaymentReservation,
  invoiceExtensionsWithCardPaymentReservation,
  invoicePaymentExtension,
  invoicePaymentTag,
  NIO_INVOICE_PAYMENT_ID_SYSTEM,
} from 'utils/lib/fhir/billing-invoice';
import {
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT,
  PAYMENT_METHOD_EXTENSION_URL,
  PAYMENT_STRIPE_ACCOUNT_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import {
  BILLING_INVOICE_CONFLICT_ERROR,
  GENERIC_STRIPE_PAYMENT_ERROR,
  STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR,
} from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/charge-billing-nio-invoice-card';
import { resolveInvoiceStripePayer } from '../../../src/billing/invoice-stripe';
import { STRIPE_METADATA_KEYS, STRIPE_PAYMENT_ID_SYSTEM } from '../../../src/shared/stripeIntegration';

vi.mock('../../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('../../../src/billing/invoice-stripe', () => ({
  resolveInvoiceStripePayer: vi.fn(),
}));

const INVOICE_ID = 'invoice-1';
const PAYMENT_ID = 'payment-key-1';
const STRIPE_ACCOUNT = 'acct_issuer';
const NOW = DateTime.fromISO('2026-11-19T15:00:00.000Z');

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

const nio = (customerAccount: string | undefined = STRIPE_ACCOUNT): Organization => ({
  resourceType: 'Organization',
  id: 'nio-1',
  identifier: customerAccount
    ? [
        {
          system: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
          value: 'cus_nio',
          extension: [
            {
              url: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT,
              valueString: customerAccount,
            },
          ],
        },
      ]
    : [],
});

const recordedPayment = (amount: number): PaymentNotice => ({
  resourceType: 'PaymentNotice',
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
      value: PAYMENT_ID,
    },
  ],
  meta: {
    tag: [invoicePaymentTag(INVOICE_ID)],
  },
  extension: [invoicePaymentExtension(INVOICE_ID)],
});

const setup = ({
  notices = [],
  paymentIntentStatus = 'succeeded',
}: {
  notices?: PaymentNotice[];
  paymentIntentStatus?: Stripe.PaymentIntent.Status;
} = {}): {
  oystehr: Oystehr;
  stripe: Stripe;
  createPaymentIntent: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  resultsByType: Record<string, unknown[]>;
} => {
  const resultsByType: Record<string, unknown[]> = {
    Invoice: [nioInvoice()],
    PaymentNotice: notices,
  };
  const currentInvoice = (): Invoice => resultsByType.Invoice[0] as Invoice;
  const transaction = vi.fn(async () => ({
    unbundle: () => [],
  }));
  // applies the reservation writes, which replace the invoice's extensions
  const patch = vi.fn(async ({ operations }: { operations: { path: string; value: Invoice['extension'] }[] }) => {
    const invoice = currentInvoice();
    resultsByType.Invoice = [
      {
        ...invoice,
        extension: operations.find((operation) => operation.path === '/extension')?.value,
        meta: {
          versionId: String(Number(invoice.meta?.versionId) + 1),
        },
      },
    ];
  });
  const createPaymentIntent = vi.fn().mockResolvedValue({
    id: 'pi_1',
    status: paymentIntentStatus,
  });
  return {
    oystehr: {
      fhir: {
        search: vi.fn(async ({ resourceType }: { resourceType: string }) => ({
          unbundle: () => resultsByType[resourceType],
        })),
        get: vi.fn(async () => currentInvoice()),
        transaction,
        patch,
      },
    } as unknown as Oystehr,
    stripe: {
      paymentIntents: {
        create: createPaymentIntent,
      },
    } as unknown as Stripe,
    createPaymentIntent,
    transaction,
    patch,
    resultsByType,
  };
};

const reservationOf = (resultsByType: Record<string, unknown[]>): InvoiceCardPaymentReservation | undefined =>
  getInvoiceCardPaymentReservation(resultsByType.Invoice[0] as Invoice);

const params = {
  invoiceId: INVOICE_ID,
  amountInCents: 32000,
  paymentMethodId: 'pm_1',
  idempotencyKey: PAYMENT_ID,
  secrets: {},
  agent: {
    who: {
      reference: 'Practitioner/biller-1',
    },
  },
};

const writtenNotices = (transaction: ReturnType<typeof vi.fn>): PaymentNotice[] =>
  (transaction.mock.calls[0][0].requests as BatchInputRequest<FhirResource>[])
    .filter(
      (request): request is BatchInputPostRequest<PaymentNotice> =>
        request.method === 'POST' && request.url === '/PaymentNotice'
    )
    .map((request) => request.resource);

describe('charge-billing-nio-invoice-card', () => {
  beforeEach(() => {
    vi.mocked(resolveInvoiceStripePayer).mockResolvedValue({
      stripeAccount: STRIPE_ACCOUNT,
      nio: nio(),
    });
  });

  it("charges the balance to the NIO's card, keyed by the payment id", async () => {
    const { oystehr, stripe, createPaymentIntent } = setup();

    await performEffect({
      oystehr,
      stripe,
      params,
      now: NOW,
    });

    expect(createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 32000,
        customer: 'cus_nio',
        payment_method: 'pm_1',
        confirm: true,
        off_session: true,
        metadata: {
          [STRIPE_METADATA_KEYS.invoiceId]: INVOICE_ID,
          [STRIPE_METADATA_KEYS.invoicePaymentId]: PAYMENT_ID,
          [STRIPE_METADATA_KEYS.organizationId]: 'nio-1',
        },
      }),
      {
        stripeAccount: STRIPE_ACCOUNT,
        idempotencyKey: `nio-invoice-payment-${INVOICE_ID}-${PAYMENT_ID}`,
      }
    );
  });

  it('records a card payment per claim with the PaymentIntent and account', async () => {
    const { oystehr, stripe, transaction } = setup();

    const result = await performEffect({
      oystehr,
      stripe,
      params,
      now: NOW,
    });

    expect(result).toEqual({
      paymentId: PAYMENT_ID,
    });
    const notices = writtenNotices(transaction);
    expect(notices.map((notice) => [notice.request?.reference, notice.amount.value])).toEqual([
      ['Claim/claim-1', 180],
      ['Claim/claim-2', 140],
    ]);
    for (const notice of notices) {
      expect(getNioInvoicePaymentId(notice)).toBe(PAYMENT_ID);
      expect(notice.extension).toContainEqual({
        url: PAYMENT_METHOD_EXTENSION_URL,
        valueString: 'card',
      });
      expect(notice.extension).toContainEqual(
        expect.objectContaining({
          url: PAYMENT_STRIPE_ACCOUNT_EXTENSION_URL,
        })
      );
      expect(notice.contained?.[0]).toMatchObject({
        paymentIdentifier: {
          system: STRIPE_PAYMENT_ID_SYSTEM,
          value: 'pi_1',
        },
      });
      expect(notice.identifier?.some((identifier) => identifier.system === STRIPE_PAYMENT_ID_SYSTEM)).toBe(false);
    }
  });

  it('returns without charging again when the payment is already recorded', async () => {
    const { oystehr, stripe, createPaymentIntent, transaction } = setup({
      notices: [recordedPayment(180), recordedPayment(140)],
    });

    await performEffect({
      oystehr,
      stripe,
      params,
      now: NOW,
    });

    expect(createPaymentIntent).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('refuses a NIO with no Stripe customer on the account', async () => {
    vi.mocked(resolveInvoiceStripePayer).mockResolvedValue({
      stripeAccount: STRIPE_ACCOUNT,
      nio: nio('acct_other'),
    });
    const { oystehr, stripe, createPaymentIntent, resultsByType } = setup();

    await expect(
      performEffect({
        oystehr,
        stripe,
        params,
        now: NOW,
      })
    ).rejects.toEqual(STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR);
    expect(createPaymentIntent).not.toHaveBeenCalled();
    expect(reservationOf(resultsByType)).toBeUndefined();
  });

  it('records nothing and releases the invoice when the charge does not succeed', async () => {
    const { oystehr, stripe, transaction, resultsByType } = setup({
      paymentIntentStatus: 'requires_payment_method',
    });

    await expect(
      performEffect({
        oystehr,
        stripe,
        params,
        now: NOW,
      })
    ).rejects.toEqual(GENERIC_STRIPE_PAYMENT_ERROR);
    expect(transaction).not.toHaveBeenCalled();
    expect(reservationOf(resultsByType)).toBeUndefined();
  });

  it('reserves the invoice before charging, and releases it with the recorded payment', async () => {
    const { oystehr, stripe, createPaymentIntent, patch, transaction } = setup();

    await performEffect({
      oystehr,
      stripe,
      params,
      now: NOW,
    });

    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Invoice',
        id: INVOICE_ID,
      }),
      {
        optimisticLockingVersionId: '3',
      }
    );
    expect(patch.mock.invocationCallOrder[0]).toBeLessThan(createPaymentIntent.mock.invocationCallOrder[0]);
    const [invoicePatch] = transaction.mock.calls[0][0].requests;
    expect(invoicePatch).toMatchObject({
      method: 'PATCH',
      ifMatch: 'W/"4"',
    });
    const operations = JSON.parse(atob(invoicePatch.resource.data));
    expect(operations).toContainEqual({
      op: 'add',
      path: '/extension',
      value: nioInvoice().extension,
    });
  });

  it('releases the invoice when the card is declined', async () => {
    const { oystehr, stripe, createPaymentIntent, resultsByType } = setup();
    createPaymentIntent.mockRejectedValueOnce({
      type: 'StripeCardError',
      message: 'Your card was declined.',
    });

    await expect(
      performEffect({
        oystehr,
        stripe,
        params,
        now: NOW,
      })
    ).rejects.toBeDefined();
    expect(reservationOf(resultsByType)).toBeUndefined();
  });

  it('keeps the invoice reserved when Stripe does not answer, since the card may have been charged', async () => {
    const { oystehr, stripe, createPaymentIntent, resultsByType } = setup();
    createPaymentIntent.mockRejectedValueOnce({
      type: 'StripeConnectionError',
      message: 'timeout',
    });

    await expect(
      performEffect({
        oystehr,
        stripe,
        params,
        now: NOW,
      })
    ).rejects.toBeDefined();
    expect(reservationOf(resultsByType)).toEqual({
      paymentId: PAYMENT_ID,
      reservedAt: NOW.toUTC().toISO(),
    });
  });

  it("refuses to charge while another request's card payment may still be charging", async () => {
    const { oystehr, stripe, createPaymentIntent, resultsByType } = setup();
    const invoice = nioInvoice();
    resultsByType.Invoice = [
      {
        ...invoice,
        extension: invoiceExtensionsWithCardPaymentReservation(invoice, {
          paymentId: 'other-payment',
          reservedAt: NOW.minus({ seconds: 30 }).toUTC().toISO()!,
        }),
      },
    ];
    (stripe.paymentIntents as unknown as { list: ReturnType<typeof vi.fn> }).list = vi.fn().mockResolvedValue({
      data: [],
    });

    await expect(
      performEffect({
        oystehr,
        stripe,
        params,
        now: NOW,
      })
    ).rejects.toEqual(
      BILLING_INVOICE_CONFLICT_ERROR('A card payment on invoice INV-00042 is in progress. Try again in a few minutes.')
    );
    expect(createPaymentIntent).not.toHaveBeenCalled();
  });

  it('says the card was charged when the invoice was voided before the payment was recorded', async () => {
    const { oystehr, stripe, transaction, resultsByType } = setup();
    transaction.mockImplementationOnce(async () => {
      resultsByType.Invoice = [
        nioInvoice({
          status: 'cancelled',
        }),
      ];
      throw {
        code: 412,
      };
    });

    await expect(
      performEffect({
        oystehr,
        stripe,
        params,
        now: NOW,
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining('The card was charged (pi_1)'),
    });
  });
});
