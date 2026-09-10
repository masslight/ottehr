import { Task } from 'fhir/r4b';
import { createClaimFromEncounter } from '../../../billing/create-billing-claim-from-encounter/handler';
import { createBillingClient } from '../../../billing/shared';
import { wrapTaskHandler } from '../helpers';
import { BillingClaimTaskParams, validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'sub-billing-claim-task';

export const index = wrapTaskHandler(
  ZAMBDA_NAME,
  async (input) => {
    const params = validateRequestParameters(input);
    return performEffect(params);
  },
  { createClient: createBillingClient }
);

async function performEffect(
  params: BillingClaimTaskParams
): Promise<{ taskStatus: Task['status']; statusReason: string }> {
  await createClaimFromEncounter(params);
  return { taskStatus: 'completed', statusReason: 'Claim created successfully' };
}
