import Oystehr, { SearchParam } from '@oystehr/sdk';
import { Claim, Invoice, Location } from 'fhir/r4b';
import {
  getBillingInvoiceClaims,
  getBillingInvoiceDueDate,
  getHostedInvoiceUrl,
  INVOICE_CLAIM_TAG_SYSTEM,
} from 'utils/lib/fhir/billing-invoice';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import {
  BILLING_INVOICE_LIST_STATUSES,
  BillingInvoiceListStatus,
} from 'utils/lib/types/data/billing/billing.constants';
import { BillingInvoiceSummary } from 'utils/lib/types/data/billing/billing.types';
import { getClaimStatusValues, isInvoiceableClaimStatus } from 'utils/lib/types/data/billing/claim-status';
import { INVALID_INPUT_ERROR, RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR } from 'utils/lib/types/errors';
import { copySourceId, fetchById, findById } from './shared';

// The claim points at its own copy of the service facility. The copy records which facility it came from.
export async function getServiceFacilityId(oystehr: Oystehr, claim: Claim): Promise<string | undefined> {
  const copyId = getIdFromReference(claim.facility?.reference, 'Location');
  return copyId ? copySourceId(await findById<Location>(oystehr, 'Location', copyId)) : undefined;
}

const activeClaimInvoiceParams = (claimIds: string[]): SearchParam[] => [
  {
    name: '_tag',
    value: claimIds.map((claimId) => `${INVOICE_CLAIM_TAG_SYSTEM}|${claimId}`).join(','),
  },
  {
    name: '_tag',
    value: `${BILLING_RESOURCE_TAG.system}|${BILLING_RESOURCE_TAG.code}`,
  },
  {
    name: 'status',
    value: 'draft,issued,balanced',
  },
];

export async function createInvoiceUnlessClaimsHaveOne(oystehr: Oystehr, invoice: Invoice): Promise<Invoice> {
  const claimIds = getBillingInvoiceClaims(invoice).map(({ claimId }) => claimId);
  return oystehr.fhir.create<Invoice>(invoice, {
    ifNoneExist: activeClaimInvoiceParams(claimIds),
  });
}

export async function fetchActiveClaimInvoices(oystehr: Oystehr, claimIds: string[]): Promise<Invoice[]> {
  return getAllFhirSearchPages<Invoice>(
    {
      resourceType: 'Invoice',
      params: activeClaimInvoiceParams(claimIds),
    },
    oystehr
  );
}

export async function fetchClaimInvoices(oystehr: Oystehr, claimId: string): Promise<Invoice[]> {
  return (
    await oystehr.fhir.search<Invoice>({
      resourceType: 'Invoice',
      params: [
        { name: '_tag', value: `${INVOICE_CLAIM_TAG_SYSTEM}|${claimId}` },
        { name: 'status', value: BILLING_INVOICE_LIST_STATUSES.join(',') },
        { name: '_sort', value: '-date' },
      ],
    })
  ).unbundle();
}

export const toBillingInvoiceSummary = (invoice: Invoice): BillingInvoiceSummary => ({
  id: invoice.id!,
  status: invoice.status as BillingInvoiceListStatus,
  issueDate: invoice.date ?? '',
  dueDate: getBillingInvoiceDueDate(invoice) ?? '',
  amount: invoice.totalGross?.value ?? 0,
  hostedInvoiceUrl: getHostedInvoiceUrl(invoice),
});

// Returns the clinical visit behind a claim that can be invoiced.
export function getInvoiceableEncounterId(claim: Claim): string {
  if (!isInvoiceableClaimStatus(getClaimStatusValues(claim))) {
    throw INVALID_INPUT_ERROR(
      'Only Patient AR claims that are ready to invoice, invoiced or finalized can be invoiced'
    );
  }
  return getClaimEncounterId(claim);
}

// Returns the clinical visit behind an invoice's claim.
export async function getInvoiceEncounterId(oystehr: Oystehr, invoiceId: string): Promise<string> {
  const [{ claimId }] = getBillingInvoiceClaims(await fetchById<Invoice>(oystehr, 'Invoice', invoiceId));
  return getClaimEncounterId(await fetchById<Claim>(oystehr, 'Claim', claimId));
}

function getClaimEncounterId(claim: Claim): string {
  const encounterId = claim.identifier?.find(
    (identifier) => identifier.system === ottehrIdentifierSystem('claim-encounter-id')
  )?.value;
  if (!encounterId) throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR('Claim is not linked to a visit');
  return encounterId;
}
