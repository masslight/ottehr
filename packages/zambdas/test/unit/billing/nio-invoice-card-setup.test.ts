import Oystehr from '@oystehr/sdk';
import { Claim, FhirResource, Invoice, Location, Organization } from 'fhir/r4b';
import Stripe from 'stripe';
import { buildBillingInvoice } from 'utils/lib/fhir/billing-invoice';
import {
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT,
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { InvoiceIssuerSource } from 'utils/lib/types/constants';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveInvoiceStripePayer } from '../../../src/billing/invoice-stripe';
import { performEffect as listPaymentMethods } from '../../../src/billing/list-billing-nio-invoice-payment-methods';
import { performEffect as setupCard } from '../../../src/billing/setup-billing-nio-invoice-card';
import { STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';
import { readInvoicingConfig } from '../../../src/rcm/invoice-config/helpers';

vi.mock('../../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('../../../src/rcm/invoice-config/helpers', () => ({
  readInvoicingConfig: vi.fn(),
}));

const INVOICE_ID = 'invoice-1';
const ISSUER_ACCOUNT = 'acct_issuer';
const FACILITY_ACCOUNT = 'acct_facility';

const invoice = (recipient = 'Organization/nio-1'): Invoice => ({
  ...buildBillingInvoice({
    status: 'issued',
    date: '2026-11-01T15:00:00.000Z',
    dueDate: '2026-11-30',
    issuer: {
      reference: 'Organization/issuer-1',
    },
    recipient: {
      reference: recipient,
    },
    claims: [
      {
        claimId: 'claim-1',
        amountCents: 18000,
      },
    ],
  }),
  id: INVOICE_ID,
});

const issuer: Organization = {
  resourceType: 'Organization',
  id: 'issuer-1',
  identifier: [
    {
      system: STRIPE_ACCOUNT_IDENTIFIER_SYSTEM,
      value: ISSUER_ACCOUNT,
    },
  ],
};

const nio = (customerAccount?: string): Organization => ({
  resourceType: 'Organization',
  id: 'nio-1',
  name: 'FedEx',
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

const claim: Claim = {
  resourceType: 'Claim',
  id: 'claim-1',
  facility: {
    reference: 'Location/facility-copy-1',
  },
} as Claim;

const facility: Location = {
  resourceType: 'Location',
  id: 'facility-copy-1',
  extension: [
    {
      url: SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
      valueString: FACILITY_ACCOUNT,
    },
  ],
};

const makeOystehr = (resources: FhirResource[]): Oystehr =>
  ({
    fhir: {
      search: vi.fn(
        async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
          const id = params.find((param) => param.name === '_id')?.value;
          const found = resources.filter((resource) => resource.resourceType === resourceType && resource.id === id);
          const included = resourceType === 'Claim' ? [facility] : [];
          return {
            unbundle: () => [...found, ...included],
          };
        }
      ),
    },
  }) as unknown as Oystehr;

const useIssuerSource = (invoiceIssuerSource: InvoiceIssuerSource): void => {
  vi.mocked(readInvoicingConfig).mockResolvedValue({
    invoiceIssuerSource,
  } as Awaited<ReturnType<typeof readInvoicingConfig>>);
};

describe('resolveInvoiceStripePayer', () => {
  beforeEach(() => useIssuerSource('service-facility'));

  it("pays on the service facility's account", async () => {
    const payer = await resolveInvoiceStripePayer({
      oystehr: makeOystehr([issuer, nio(), claim]),
      invoice: invoice(),
    });

    expect(payer.stripeAccount).toBe(FACILITY_ACCOUNT);
    expect(payer.nio.id).toBe('nio-1');
  });

  it("pays on the issuing organization's account when the issuer is the billing provider", async () => {
    useIssuerSource('billing-provider');

    const payer = await resolveInvoiceStripePayer({
      oystehr: makeOystehr([issuer, nio(), claim]),
      invoice: invoice(),
    });

    expect(payer.stripeAccount).toBe(ISSUER_ACCOUNT);
  });

  it('refuses a patient invoice', async () => {
    await expect(
      resolveInvoiceStripePayer({
        oystehr: makeOystehr([issuer, nio(), claim]),
        invoice: invoice('Patient/pat-1'),
      })
    ).rejects.toEqual(INVALID_INPUT_ERROR('Only non-insurance payer invoices take recorded payments'));
  });
});

describe('setup-billing-nio-invoice-card', () => {
  beforeEach(() => useIssuerSource('service-facility'));

  it("creates a card SetupIntent for the NIO's customer on the invoice's account", async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'seti_1',
      client_secret: 'seti_1_secret',
    });
    const stripe = {
      setupIntents: {
        create,
      },
    } as unknown as Stripe;

    const response = await setupCard({
      oystehr: makeOystehr([invoice(), issuer, nio(FACILITY_ACCOUNT), claim]),
      stripe,
      invoiceId: INVOICE_ID,
    });

    expect(response).toEqual({
      clientSecret: 'seti_1_secret',
      stripeAccount: FACILITY_ACCOUNT,
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_nio',
        payment_method_types: ['card'],
      }),
      {
        stripeAccount: FACILITY_ACCOUNT,
      }
    );
  });
});

describe('list-billing-nio-invoice-payment-methods', () => {
  beforeEach(() => useIssuerSource('service-facility'));

  it('lists no cards without calling Stripe when the NIO has no customer on the account', async () => {
    const stripe = {
      customers: {
        retrieve: vi.fn(),
        listPaymentMethods: vi.fn(),
      },
    } as unknown as Stripe;

    const response = await listPaymentMethods({
      oystehr: makeOystehr([invoice(), issuer, nio(ISSUER_ACCOUNT), claim]),
      stripe,
      invoiceId: INVOICE_ID,
    });

    expect(response).toEqual({
      cards: [],
    });
    expect(stripe.customers.retrieve).not.toHaveBeenCalled();
  });

  it("lists the cards of the NIO's customer on the invoice's account", async () => {
    const listMethods = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'pm_1',
          card: {
            brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2099,
          },
        },
      ],
    });
    const stripe = {
      customers: {
        retrieve: vi.fn().mockResolvedValue({
          deleted: false,
          invoice_settings: {
            default_payment_method: 'pm_1',
          },
        }),
        listPaymentMethods: listMethods,
      },
    } as unknown as Stripe;

    const response = await listPaymentMethods({
      oystehr: makeOystehr([invoice(), issuer, nio(FACILITY_ACCOUNT), claim]),
      stripe,
      invoiceId: INVOICE_ID,
    });

    expect(response.cards.map((card) => [card.id, card.lastFour, card.default])).toEqual([['pm_1', '4242', true]]);
    expect(listMethods).toHaveBeenCalledWith('cus_nio', expect.anything(), {
      stripeAccount: FACILITY_ACCOUNT,
    });
  });
});
