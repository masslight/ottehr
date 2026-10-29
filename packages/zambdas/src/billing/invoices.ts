import Oystehr from '@oystehr/sdk';
import { Claim, Invoice } from 'fhir/r4b';
import {
  getBillingInvoiceDueDate,
  getHostedInvoiceUrl,
  INVOICE_CLAIM_TAG_SYSTEM,
} from 'utils/lib/fhir/billing-invoice';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import {
  BILLING_INVOICE_LIST_STATUSES,
  BillingInvoiceListStatus,
} from 'utils/lib/types/data/billing/billing.constants';
import { BillingInvoiceSummary } from 'utils/lib/types/data/billing/billing.types';
import { getClaimStatusValues, isInvoiceableClaimStatus } from 'utils/lib/types/data/billing/claim-status';
import { INVALID_INPUT_ERROR, RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR } from 'utils/lib/types/errors';

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
  const encounterId = claim.identifier?.find(
    (identifier) => identifier.system === ottehrIdentifierSystem('claim-encounter-id')
  )?.value;
  if (!encounterId) throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR('Claim is not linked to a visit');
  return encounterId;
}
