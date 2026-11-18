import { APIGatewayProxyResult } from 'aws-lambda';
import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { listOutreachTasks } from '../manage-outreach-tasks';

let m2mToken: string;

const ZAMBDA_NAME = 'list-outreach-tasks';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, input.secrets);

  const response = await listOutreachTasks(oystehr, input.body ? JSON.parse(input.body) : {});

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
