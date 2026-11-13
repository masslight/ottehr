import { APIGatewayProxyResult } from 'aws-lambda';
import { cancelPendingOutreachTask } from '../../rcm/scheduled-outreach/manage-outreach-tasks';
import { OUTREACH_CANCELLED_BY_STAFF_TAG } from '../../rcm/scheduled-outreach/producers/shared/produce-outreach-tasks';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createBillingClient } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'cancel-billing-outreach-task';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { taskId, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  return cancelPendingOutreachTask(oystehr, taskId, OUTREACH_CANCELLED_BY_STAFF_TAG);
});
