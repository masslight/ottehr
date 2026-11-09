import { SearchParam } from '@oystehr/sdk';
import { Claim, Location, Organization, Practitioner, Resource } from 'fhir/r4b';
import { InvoiceIssuer, resolveInvoiceIssuer } from 'utils/lib/fhir/billing-invoice';
import { InvoiceIssuerSource } from 'utils/lib/types/constants';
import { copySourceRef, findRef } from './shared';

// Add to a Claim search so its results carry what resolveClaimInvoiceIssuer reads.
export const INVOICE_ISSUER_CLAIM_INCLUDES: SearchParam[] = [
  {
    name: '_include',
    value: 'Claim:provider',
  },
  {
    name: '_include',
    value: 'Claim:facility',
  },
];

export const resolveClaimInvoiceIssuer = (
  claim: Claim,
  resources: Resource[],
  source: InvoiceIssuerSource
): InvoiceIssuer => {
  const billingProvider = findRef<Organization | Practitioner>(resources, claim.provider?.reference);
  const issuer = resolveInvoiceIssuer({
    source,
    facility: findRef<Location>(resources, claim.facility?.reference),
    billingProvider,
  });
  const originalReference = copySourceRef(billingProvider);
  if (!originalReference || issuer.organization.reference !== `Organization/${billingProvider?.id}`) return issuer;
  return {
    ...issuer,
    organization: {
      reference: originalReference,
    },
  };
};
