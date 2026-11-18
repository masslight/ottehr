import { APIGatewayProxyResult } from 'aws-lambda';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { retryFailedOutreachTask } from '../manage-outreach-tasks';

let m2mToken: string;

export const index = wrapHandler('retry-outreach-task', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const body = typeof input.body === 'string' ? (JSON.parse(input.body) as Record<string, unknown>) : input.body ?? {};
  const secrets = input.secrets;
  if (!secrets) throw MISSING_REQUEST_SECRETS;
  if (!body) throw MISSING_REQUEST_BODY;

  const taskId = body.taskId as string | undefined;
  if (!taskId) throw MISSING_REQUIRED_PARAMETERS(['taskId']);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  return retryFailedOutreachTask(oystehr, taskId);
});
