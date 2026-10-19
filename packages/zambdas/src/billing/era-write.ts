import Oystehr from '@oystehr/sdk';
import { ClaimResponse, PaymentReconciliation } from 'fhir/r4b';
import { ERA_VOID_STATUS } from 'utils/lib/types/data/billing/billing.constants';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { fetchClaimEraLinks } from './claim-amounts';

export function assertEraNotVoided(era: PaymentReconciliation): void {
  if (era.status === ERA_VOID_STATUS) throw INVALID_INPUT_ERROR('Voided ERAs cannot be changed');
}

export async function assertClaimResponseEraNotVoided(oystehr: Oystehr, claimResponse: ClaimResponse): Promise<void> {
  const { paymentReconciliations } = await fetchClaimEraLinks(oystehr, [claimResponse]);
  paymentReconciliations.forEach(assertEraNotVoided);
}
