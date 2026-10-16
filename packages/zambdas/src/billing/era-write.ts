import Oystehr, { BatchInputPutRequest } from '@oystehr/sdk';
import { ClaimResponse, PaymentReconciliation } from 'fhir/r4b';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { ERA_VOID_STATUS } from 'utils/lib/types/data/billing/billing.constants';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { assertDefined } from '../shared/helpers';
import { fetchClaimEraLinks } from './claim-amounts';

export function assertEraNotVoided(era: PaymentReconciliation): void {
  if (era.status === ERA_VOID_STATUS) throw INVALID_INPUT_ERROR('Voided ERAs cannot be changed');
}

// Write the parent in the same transaction so an edit cannot race past a void.
export function eraEditGuard(era: PaymentReconciliation): BatchInputPutRequest<PaymentReconciliation> {
  assertEraNotVoided(era);
  const id = assertDefined(era.id, 'ERA id');
  const version = assertDefined(era.meta?.versionId, `PaymentReconciliation/${id} version`);
  return {
    method: 'PUT',
    url: `/PaymentReconciliation/${id}`,
    resource: era,
    ifMatch: makeOptimisticLockIfMatchHeader(version),
  };
}

export async function claimResponseEraEditGuards(
  oystehr: Oystehr,
  claimResponse: ClaimResponse
): Promise<BatchInputPutRequest<PaymentReconciliation>[]> {
  const { paymentReconciliations } = await fetchClaimEraLinks(oystehr, [claimResponse]);
  if (paymentReconciliations.length === 0) {
    throw INVALID_INPUT_ERROR('The ERA for this claim response could not be found');
  }
  return paymentReconciliations.map(eraEditGuard);
}
