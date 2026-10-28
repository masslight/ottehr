import Oystehr from '@oystehr/sdk';
import { Location, Organization } from 'fhir/r4b';
import Stripe from 'stripe';
import {
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT,
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { describe, expect, it, vi } from 'vitest';
import {
  ensureOrganizationStripeCustomerId,
  getStripeAccountForInvoiceIssuer,
} from '../../../src/billing/invoice-stripe';
import { STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';

const organization: Organization & { id: string } = {
  resourceType: 'Organization',
  id: 'nio-1',
  name: 'FedEx',
  meta: {
    versionId: '3',
  },
};

const stripeCustomer = (stripeAccount: string, customerId: string): Organization['identifier'] => [
  {
    system: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
    value: customerId,
    extension: [
      {
        url: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT,
        valueString: stripeAccount,
      },
    ],
  },
];

const versionConflict = (): Error =>
  Object.assign(new Error('Precondition Failed'), {
    code: 412,
  });

function makeClients(): { oystehr: Oystehr; stripe: Stripe } {
  return {
    oystehr: {
      fhir: {
        get: vi.fn(),
        patch: vi.fn(),
      },
    } as unknown as Oystehr,
    stripe: {
      customers: {
        create: vi.fn().mockResolvedValue({
          id: 'cus_new',
        }),
      },
    } as unknown as Stripe,
  };
}

describe('getStripeAccountForInvoiceIssuer', () => {
  const facility: Location = {
    resourceType: 'Location',
    id: 'facility-1',
    extension: [
      {
        url: SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
        valueString: 'acct_facility',
      },
    ],
  };
  const stampedOrganization: Organization = {
    ...organization,
    identifier: [
      {
        system: STRIPE_ACCOUNT_IDENTIFIER_SYSTEM,
        value: 'acct_provider',
      },
    ],
  };

  it("prefers the issuer organization's account, then the facility's", () => {
    expect(
      getStripeAccountForInvoiceIssuer({
        issuerOrganization: stampedOrganization,
        facility,
      })
    ).toBe('acct_provider');
    expect(
      getStripeAccountForInvoiceIssuer({
        issuerOrganization: organization,
        facility,
      })
    ).toBe('acct_facility');
  });

  it('is the platform account when neither has one', () => {
    expect(
      getStripeAccountForInvoiceIssuer({
        issuerOrganization: organization,
      })
    ).toBeUndefined();
  });
});

describe('ensureOrganizationStripeCustomerId', () => {
  it('reuses the customer stored for the Stripe account', async () => {
    const { oystehr, stripe } = makeClients();

    const customerId = await ensureOrganizationStripeCustomerId({
      oystehr,
      stripe,
      organization: {
        ...organization,
        identifier: stripeCustomer('acct_1', 'cus_existing'),
      },
      stripeAccount: 'acct_1',
    });

    expect(customerId).toBe('cus_existing');
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(oystehr.fhir.patch).not.toHaveBeenCalled();
  });

  it('creates and stores a separate customer for another Stripe account', async () => {
    const { oystehr, stripe } = makeClients();

    const customerId = await ensureOrganizationStripeCustomerId({
      oystehr,
      stripe,
      organization: {
        ...organization,
        identifier: stripeCustomer('acct_1', 'cus_existing'),
      },
      stripeAccount: 'acct_2',
    });

    expect(customerId).toBe('cus_new');
    expect(stripe.customers.create).toHaveBeenCalledWith(
      {
        name: 'FedEx',
        metadata: {
          oystehr_organization_id: 'nio-1',
        },
      },
      {
        stripeAccount: 'acct_2',
        idempotencyKey: 'organization-customer-nio-1-acct_2',
      }
    );
    expect(oystehr.fhir.patch).toHaveBeenCalledWith(
      {
        resourceType: 'Organization',
        id: 'nio-1',
        operations: [
          {
            op: 'add',
            path: '/identifier/-',
            value: stripeCustomer('acct_2', 'cus_new')?.[0],
          },
        ],
      },
      {
        optimisticLockingVersionId: '3',
      }
    );
  });

  it('starts the identifier list on an organization without one', async () => {
    const { oystehr, stripe } = makeClients();

    await ensureOrganizationStripeCustomerId({
      oystehr,
      stripe,
      organization,
      stripeAccount: undefined,
    });

    expect(oystehr.fhir.patch).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [
          {
            op: 'add',
            path: '/identifier',
            value: [
              {
                system: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
                value: 'cus_new',
              },
            ],
          },
        ],
      }),
      expect.anything()
    );
  });

  it('keeps the customer another caller stored while this one was creating', async () => {
    const { oystehr, stripe } = makeClients();
    vi.mocked(oystehr.fhir.patch).mockRejectedValueOnce(versionConflict());
    vi.mocked(oystehr.fhir.get).mockResolvedValueOnce({
      ...organization,
      meta: {
        versionId: '4',
      },
      identifier: stripeCustomer('acct_1', 'cus_concurrent'),
    });

    const customerId = await ensureOrganizationStripeCustomerId({
      oystehr,
      stripe,
      organization,
      stripeAccount: 'acct_1',
    });

    expect(customerId).toBe('cus_concurrent');
    expect(oystehr.fhir.patch).toHaveBeenCalledTimes(1);
  });
});
