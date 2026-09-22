import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { createClaimFromEncounter } from '../../../billing/create-billing-claim-from-encounter/handler';
import { findBillingClaimForEncounter } from '../../../billing/payments';
import { createBillingClient } from '../../../billing/shared';
import { wrapTaskHandler } from '../helpers';
import { BillingClaimTaskParams, validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'sub-billing-claim-task';

export const index = wrapTaskHandler(
  ZAMBDA_NAME,
  async (input, oystehr) => {
    const params = validateRequestParameters(input);
    return performEffect(oystehr, params);
  },
  { createClient: createBillingClient }
);

async function performEffect(
  oystehr: Oystehr,
  params: BillingClaimTaskParams
): Promise<{ taskStatus: Task['status']; statusReason: string }> {
  const existingClaim = await findBillingClaimForEncounter(oystehr, params.encounterId);
  if (existingClaim) {
    return { taskStatus: 'completed', statusReason: 'Claim already exists for this encounter' };
  }
  await createClaimFromEncounter(params);
  return { taskStatus: 'completed', statusReason: 'Claim created successfully' };
}
