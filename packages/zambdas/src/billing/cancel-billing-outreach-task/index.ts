import { APIGatewayProxyResult } from 'aws-lambda';
import { BillingOutreachTaskInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { MISCONFIGURED_ENVIRONMENT_ERROR } from 'utils/lib/types/errors';
import { cancelPendingOutreachTask } from '../../rcm/scheduled-outreach/manage-outreach-tasks';
import { OUTREACH_CANCELLED_BY_STAFF_TAG } from '../../rcm/scheduled-outreach/producers/shared/produce-outreach-tasks';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { isOutreachInBillingApp } from '../../shared/invoice-tasks';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { createBillingClient } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'cancel-billing-outreach-task';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { taskId, secrets } = validateWithSchema(BillingOutreachTaskInputSchema, input);
  if (!isOutreachInBillingApp(secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Outreach is not enabled in the billing app');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  return cancelPendingOutreachTask(oystehr, taskId, OUTREACH_CANCELLED_BY_STAFF_TAG);
});
