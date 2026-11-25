import Oystehr, { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { FhirResource, Invoice, Organization, PaymentNotice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  buildBillingInvoice,
  getInvoiceCardPaymentReservation,
  getNioInvoicePaymentId,
  INVOICE_NUMBER_IDENTIFIER_SYSTEM,
  invoiceExtensionsWithCardPaymentReservation,
} from 'utils/lib/fhir/billing-invoice';
import {
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT,
} from 'utils/lib/fhir/constants';
import { BILLING_INVOICE_CONFLICT_ERROR } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  releaseCardReservation,
  reserveCardPayment,
  settleOtherCardReservation,
} from '../../../src/billing/invoice-card-reservation';
import { resolveInvoiceStripePayer } from '../../../src/billing/invoice-stripe';
import { STRIPE_METADATA_KEYS } from '../../../src/shared/stripeIntegration';

vi.mock('../../../src/billing/invoice-stripe', () => ({
  resolveInvoiceStripePayer: vi.fn(),
}));

const INVOICE_ID = 'invoice-1';
const STRIPE_ACCOUNT = 'acct_issuer';
const OTHER_PAYMENT_ID = 'other-payment';
const NOW = DateTime.fromISO('2026-11-19T15:00:00.000Z');
const IN_PROGRESS = BILLING_INVOICE_CONFLICT_ERROR(
  'A card payment on invoice INV-00042 is in progress. Try again in a few minutes.'
);

const reservedInvoice = (reservedAt: DateTime, renewedAt = reservedAt): Invoice => {
  const invoice: Invoice = {
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
      ],
    }),
    id: INVOICE_ID,
    meta: {
      versionId: '5',
    },
    identifier: [
      {
        system: INVOICE_NUMBER_IDENTIFIER_SYSTEM,
        value: 'INV-00042',
      },
    ],
  };
  return {
    ...invoice,
    extension: invoiceExtensionsWithCardPaymentReservation(invoice, {
      paymentId: OTHER_PAYMENT_ID,
      reservedAt: reservedAt.toUTC().toISO()!,
      renewedAt: renewedAt.toUTC().toISO()!,
    }),
  };
};

const nio: Organization = {
  resourceType: 'Organization',
  id: 'nio-1',
  identifier: [
    {
      system: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
      value: 'cus_nio',
      extension: [
        {
          url: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT,
          valueString: STRIPE_ACCOUNT,
        },
      ],
    },
  ],
};

const setup = ({
  invoice,
  paymentIntents = [],
}: {
  invoice: Invoice;
  paymentIntents?: Partial<Stripe.PaymentIntent>[];
}): {
  oystehr: Oystehr;
  stripe: Stripe;
  list: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
} => {
  const resultsByType: Record<string, unknown[]> = {
    Invoice: [invoice],
    PaymentNotice: [],
  };
  const patch = vi.fn();
  const transaction = vi.fn(async () => ({
    unbundle: () => [],
  }));
  const list = vi.fn().mockResolvedValue({
    data: paymentIntents,
  });
  return {
    oystehr: {
      fhir: {
        search: vi.fn(async ({ resourceType }: { resourceType: string }) => ({
          unbundle: () => resultsByType[resourceType],
        })),
        patch,
        transaction,
      },
    } as unknown as Oystehr,
    stripe: {
      paymentIntents: {
        list,
      },
    } as unknown as Stripe,
    list,
    patch,
    transaction,
  };
};

const settle = (oystehr: Oystehr, stripe: Stripe, paymentId = 'my-payment'): Promise<void> =>
  settleOtherCardReservation({
    oystehr,
    getStripe: () => stripe,
    invoiceId: INVOICE_ID,
    paymentId,
    agent: {
      who: {
        reference: 'Practitioner/biller-1',
      },
    },
    secrets: {},
    now: NOW,
  });

const otherIntent = (status: Stripe.PaymentIntent.Status): Partial<Stripe.PaymentIntent> => ({
  id: 'pi_other',
  status,
  amount: 18000,
  created: NOW.minus({ minutes: 10 }).toUnixInteger(),
  metadata: {
    [STRIPE_METADATA_KEYS.invoiceId]: INVOICE_ID,
    [STRIPE_METADATA_KEYS.invoicePaymentId]: OTHER_PAYMENT_ID,
  },
});

describe('settleOtherCardReservation', () => {
  beforeEach(() => {
    vi.mocked(resolveInvoiceStripePayer).mockResolvedValue({
      stripeAccount: STRIPE_ACCOUNT,
      nio,
    });
  });

  it('leaves the payment that holds the reservation alone', async () => {
    const { oystehr, stripe, list, patch } = setup({
      invoice: reservedInvoice(NOW.minus({ minutes: 10 })),
    });

    await settle(oystehr, stripe, OTHER_PAYMENT_ID);

    expect(list).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it('records the reserved payment when its charge went through', async () => {
    const { oystehr, stripe, transaction, list } = setup({
      invoice: reservedInvoice(NOW.minus({ minutes: 10 })),
      paymentIntents: [otherIntent('succeeded')],
    });

    await settle(oystehr, stripe);

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_nio',
      }),
      {
        stripeAccount: STRIPE_ACCOUNT,
      }
    );
    const notices = (transaction.mock.calls[0][0].requests as BatchInputRequest<FhirResource>[])
      .filter(
        (request): request is BatchInputPostRequest<PaymentNotice> =>
          request.method === 'POST' && request.url === '/PaymentNotice'
      )
      .map((request) => request.resource);
    expect(notices.map(getNioInvoicePaymentId)).toEqual([OTHER_PAYMENT_ID]);
  });

  it('pages through the payer intents to find the reserved charge', async () => {
    const { oystehr, stripe, transaction, list } = setup({
      invoice: reservedInvoice(NOW.minus({ minutes: 10 })),
    });
    list
      .mockResolvedValueOnce({
        data: [
          {
            id: 'pi_newer',
            status: 'succeeded',
            metadata: {},
          },
        ],
        has_more: true,
      })
      .mockResolvedValueOnce({
        data: [otherIntent('succeeded')],
        has_more: false,
      });

    await settle(oystehr, stripe);

    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        starting_after: 'pi_newer',
      }),
      {
        stripeAccount: STRIPE_ACCOUNT,
      }
    );
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("ignores another invoice's charge under the same payment id", async () => {
    const { oystehr, stripe, transaction, patch } = setup({
      invoice: reservedInvoice(NOW.minus({ minutes: 10 })),
      paymentIntents: [
        {
          ...otherIntent('succeeded'),
          metadata: {
            [STRIPE_METADATA_KEYS.invoiceId]: 'other-invoice',
            [STRIPE_METADATA_KEYS.invoicePaymentId]: OTHER_PAYMENT_ID,
          },
        },
      ],
    });

    await settle(oystehr, stripe);

    expect(transaction).not.toHaveBeenCalled();
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it('refuses while the reserved charge is processing', async () => {
    const { oystehr, stripe, patch } = setup({
      invoice: reservedInvoice(NOW.minus({ minutes: 10 })),
      paymentIntents: [otherIntent('processing')],
    });

    await expect(settle(oystehr, stripe)).rejects.toEqual(IN_PROGRESS);
    expect(patch).not.toHaveBeenCalled();
  });

  it('searches from the first reservation after a retry renewed it', async () => {
    const reservedAt = NOW.minus({ minutes: 10 });
    const { oystehr, stripe, list, patch } = setup({
      invoice: reservedInvoice(reservedAt, NOW.minus({ minutes: 5 })),
      paymentIntents: [otherIntent('processing')],
    });

    await expect(settle(oystehr, stripe)).rejects.toEqual(IN_PROGRESS);
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        created: {
          gte: reservedAt.minus({ minutes: 1 }).toUnixInteger(),
        },
      }),
      {
        stripeAccount: STRIPE_ACCOUNT,
      }
    );
    expect(patch).not.toHaveBeenCalled();
  });

  it('refuses while a retry renewed the reservation within the grace period', async () => {
    const { oystehr, stripe, patch } = setup({
      invoice: reservedInvoice(NOW.minus({ minutes: 10 }), NOW.minus({ seconds: 30 })),
    });

    await expect(settle(oystehr, stripe)).rejects.toEqual(IN_PROGRESS);
    expect(patch).not.toHaveBeenCalled();
  });

  it('refuses while a fresh reservation has not reached Stripe yet', async () => {
    const { oystehr, stripe, patch } = setup({
      invoice: reservedInvoice(NOW.minus({ seconds: 30 })),
    });

    await expect(settle(oystehr, stripe)).rejects.toEqual(IN_PROGRESS);
    expect(patch).not.toHaveBeenCalled();
  });

  it('releases a reservation that never charged', async () => {
    const invoice = reservedInvoice(NOW.minus({ minutes: 10 }));
    const { oystehr, stripe, patch } = setup({
      invoice,
      paymentIntents: [otherIntent('requires_payment_method')],
    });

    await settle(oystehr, stripe);

    const [[{ operations }, options]] = patch.mock.calls;
    const released = {
      ...invoice,
      extension: operations[0].value,
    };
    expect(getInvoiceCardPaymentReservation(released)).toBeUndefined();
    expect(options).toEqual({
      optimisticLockingVersionId: '5',
    });
  });
});

describe('reserveCardPayment', () => {
  it('renews the reservation a retry already holds, keeping when it was first made', async () => {
    const reservedAt = NOW.minus({ minutes: 10 });
    const invoice = reservedInvoice(reservedAt);
    const { oystehr, patch } = setup({
      invoice,
    });

    const reserved = await reserveCardPayment({
      oystehr,
      invoiceId: INVOICE_ID,
      paymentId: OTHER_PAYMENT_ID,
      amountInCents: 18000,
      now: NOW,
    });

    const renewed = {
      paymentId: OTHER_PAYMENT_ID,
      reservedAt: reservedAt.toUTC().toISO(),
      renewedAt: NOW.toUTC().toISO(),
    };
    expect(reserved?.reservation).toEqual(renewed);
    const [[{ operations }]] = patch.mock.calls;
    expect(
      getInvoiceCardPaymentReservation({
        ...invoice,
        extension: operations[0].value,
      })
    ).toEqual(renewed);
  });
});

describe('releaseCardReservation', () => {
  it('keeps a reservation renewed since it was read', async () => {
    const { oystehr, patch } = setup({
      invoice: reservedInvoice(NOW.minus({ minutes: 10 }), NOW),
    });

    await releaseCardReservation({
      oystehr,
      invoiceId: INVOICE_ID,
      reservation: {
        paymentId: OTHER_PAYMENT_ID,
        reservedAt: NOW.minus({ minutes: 10 }).toUTC().toISO()!,
        renewedAt: NOW.minus({ minutes: 10 }).toUTC().toISO()!,
      },
    });

    expect(patch).not.toHaveBeenCalled();
  });
});
