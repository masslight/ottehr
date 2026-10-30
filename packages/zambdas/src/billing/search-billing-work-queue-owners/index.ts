import { APIGatewayProxyResult } from 'aws-lambda';
import { SearchBillingWorkQueueOwnersResponse } from 'utils/lib/types/data/billing/work-queue.schemas';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
// eslint-disable-next-line no-restricted-imports -- owners' Practitioners are the users' clinical profiles
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createBillingClient } from '../shared';
import { listWorkQueueOwners } from '../work-queues/owners';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-work-queue-owners';

// The users a work queue can be assigned to (everyone with the Billing Admin role).
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const owners = await listWorkQueueOwners(
    createBillingClient(m2mToken, input.secrets),
    // The owners' Practitioners are the users' clinical profiles, not billing resources.
    createClinicalOystehrClient(m2mToken, input.secrets)
  );

  const response: SearchBillingWorkQueueOwnersResponse = { owners };
  return { statusCode: 200, body: JSON.stringify(response) };
});
