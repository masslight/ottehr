import Oystehr from '@oystehr/sdk';
import { Location, Organization } from 'fhir/r4b';
import Stripe from 'stripe';
import { getStripeCustomerIdFromAccount, patchWithOptimisticLock } from 'utils/lib/fhir/helpers';
import { stripeExtValue } from '../ehr/locations/update-location/helpers';
import { makeStripeCustomerId } from '../patient/payment-methods/helpers';
import { STRIPE_METADATA_KEYS } from '../shared/stripeIntegration';
import { getStripeAccountId } from './shared';

// Undefined means the platform account.
export const getStripeAccountForInvoiceIssuer = ({
  issuerOrganization,
  facility,
}: {
  issuerOrganization: Organization;
  facility?: Location;
}): string | undefined => getStripeAccountId(issuerOrganization) ?? (facility ? stripeExtValue(facility) : undefined);

export async function ensureOrganizationStripeCustomerId({
  oystehr,
  stripe,
  organization,
  stripeAccount,
}: {
  oystehr: Oystehr;
  stripe: Stripe;
  organization: Organization;
  stripeAccount: string | undefined;
}): Promise<string> {
  const organizationId = organization.id;
  if (!organizationId) throw new Error('A Stripe customer needs a saved Organization');

  const existing = getStripeCustomerIdFromAccount(organization, stripeAccount);
  if (existing) return existing;

  const customer = await stripe.customers.create(
    {
      name: organization.name,
      metadata: {
        [STRIPE_METADATA_KEYS.organizationId]: organizationId,
      },
    },
    {
      stripeAccount,
      idempotencyKey: `organization-customer-${organizationId}-${stripeAccount ?? 'platform'}`,
    }
  );

  let customerId = customer.id;
  await patchWithOptimisticLock(
    oystehr,
    {
      ...organization,
      id: organizationId,
    },
    (current) => {
      const stored = getStripeCustomerIdFromAccount(current, stripeAccount);
      if (stored) {
        customerId = stored;
        return [];
      }
      const identifier = makeStripeCustomerId(customer.id, stripeAccount);
      return [
        current.identifier
          ? {
              op: 'add',
              path: '/identifier/-',
              value: identifier,
            }
          : {
              op: 'add',
              path: '/identifier',
              value: [identifier],
            },
      ];
    }
  );
  return customerId;
}
