import Oystehr from '@oystehr/sdk';
import { Claim, Invoice, Location, Organization } from 'fhir/r4b';
import Stripe from 'stripe';
import { getBillingInvoiceClaims, getInvoiceNumber } from 'utils/lib/fhir/billing-invoice';
import { getStripeCustomerIdFromAccount, patchWithOptimisticLock } from 'utils/lib/fhir/helpers';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { InvoiceIssuerSource } from 'utils/lib/types/constants';
import { RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR } from 'utils/lib/types/errors';
import { stripeExtValue } from '../ehr/locations/update-location/helpers';
import { makeStripeCustomerId } from '../patient/payment-methods/helpers';
import { readInvoicingConfig } from '../rcm/invoice-config/helpers';
import { STRIPE_METADATA_KEYS } from '../shared/stripeIntegration';
import { assertInvoiceTakesRecordedPayments } from './invoices';
import { fetchById, findRef, getStripeAccountId } from './shared';

// Undefined means the platform account.
export function getStripeAccountForInvoiceIssuer({
  source,
  issuerOrganization,
  facility,
}: {
  source: InvoiceIssuerSource;
  issuerOrganization: Organization;
  facility?: Location;
}): string | undefined {
  const organizationAccount = getStripeAccountId(issuerOrganization);
  if (source === 'billing-provider') return organizationAccount;
  return (facility ? stripeExtValue(facility) : undefined) ?? organizationAccount;
}

export interface InvoiceStripePayer {
  stripeAccount: string | undefined;
  nio: Organization;
}

// The NIO pays on the Stripe account of the invoice's issuer.
export async function resolveInvoiceStripePayer({
  oystehr,
  invoice,
}: {
  oystehr: Oystehr;
  invoice: Invoice;
}): Promise<InvoiceStripePayer> {
  assertInvoiceTakesRecordedPayments(invoice);
  const label = `Invoice ${getInvoiceNumber(invoice) ?? invoice.id}`;
  const issuerId = getIdFromReference(invoice.issuer?.reference, 'Organization');
  if (!issuerId) throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR(`${label} has no issuing organization`);
  const nioId = getIdFromReference(invoice.recipient?.reference, 'Organization');
  if (!nioId) throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR(`${label} has no non-insurance payer`);
  const [firstClaimId] = getBillingInvoiceClaims(invoice).map(({ claimId }) => claimId);
  if (!firstClaimId) throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR(`${label} has no claims`);

  const [{ invoiceIssuerSource }, issuerOrganization, nio, facility] = await Promise.all([
    readInvoicingConfig(oystehr),
    fetchById<Organization>(oystehr, 'Organization', issuerId),
    fetchById<Organization>(oystehr, 'Organization', nioId),
    fetchClaimFacility({
      oystehr,
      claimId: firstClaimId,
    }),
  ]);
  return {
    stripeAccount: getStripeAccountForInvoiceIssuer({
      source: invoiceIssuerSource,
      issuerOrganization,
      facility,
    }),
    nio,
  };
}

async function fetchClaimFacility({
  oystehr,
  claimId,
}: {
  oystehr: Oystehr;
  claimId: string;
}): Promise<Location | undefined> {
  const resources = (
    await oystehr.fhir.search<Claim | Location>({
      resourceType: 'Claim',
      params: [
        {
          name: '_id',
          value: claimId,
        },
        {
          name: '_include',
          value: 'Claim:facility',
        },
      ],
    })
  ).unbundle();
  const claim = resources.find((resource): resource is Claim => resource.resourceType === 'Claim');
  return findRef<Location>(resources, claim?.facility?.reference);
}

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
