import Oystehr from '@oystehr/sdk';
import { ClaimResponse, PaymentReconciliation, Reference } from 'fhir/r4b';
import { Secrets } from 'utils/lib/secrets';
import { ERA_VOID_STATUS } from 'utils/lib/types/data/billing/billing.constants';
import { INVALID_INPUT_ERROR, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { getUser } from '../shared/auth';
import { fetchClaimEraLinks } from './claim-amounts';

// The signed-in biller, recorded as the agent on the Provenance of an ERA change.
export async function getEraActor(userToken: string, secrets: Secrets): Promise<Reference> {
  const user = await getUser(userToken, secrets);
  if (!user.profile?.startsWith('Practitioner/')) throw NOT_AUTHORIZED;
  return { reference: user.profile, display: user.email || user.name };
}

export function assertEraNotVoided(era: PaymentReconciliation): void {
  if (era.status === ERA_VOID_STATUS) throw INVALID_INPUT_ERROR('Voided ERAs cannot be changed');
}

export async function assertClaimResponseEraNotVoided(oystehr: Oystehr, claimResponse: ClaimResponse): Promise<void> {
  const { paymentReconciliations } = await fetchClaimEraLinks(oystehr, [claimResponse]);
  paymentReconciliations.forEach(assertEraNotVoided);
}
