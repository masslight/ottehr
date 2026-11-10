import { APIGatewayProxyResult } from 'aws-lambda';
import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { createBillingClient } from '../../billing/shared';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { isOutreachInBillingApp } from '../../shared/invoice-tasks';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { promoteDueOutreachTasks } from '../rcm/outreach-task-promoter/promote-outreach-tasks';

let m2mToken: string;
const ZAMBDA_NAME = 'promote-billing-outreach-tasks';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  if (!isOutreachInBillingApp(input.secrets)) {
    console.log(`${ZAMBDA_NAME}: outreach is not enabled in the billing app, skipping`);
    return { statusCode: 200, body: JSON.stringify({ disabled: true }) };
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createBillingClient(m2mToken, input.secrets);

  const result = await promoteDueOutreachTasks(oystehr);
  return { statusCode: 200, body: JSON.stringify(result) };
});
