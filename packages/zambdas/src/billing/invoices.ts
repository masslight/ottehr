import { Claim } from 'fhir/r4b';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { getClaimStatusValues, isInvoiceableClaimStatus } from 'utils/lib/types/data/billing/claim-status';
import { INVALID_INPUT_ERROR, RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR } from 'utils/lib/types/errors';

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
