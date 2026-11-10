import { APIGatewayProxyResult } from 'aws-lambda';
import { MISCONFIGURED_ENVIRONMENT_ERROR, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { getOutreachConfigResponse } from '../../rcm/scheduled-outreach-config/helpers';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { isOutreachInBillingApp } from '../../shared/invoice-tasks';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createBillingClient } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-outreach-config';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!isOutreachInBillingApp(input.secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Outreach is not enabled in the billing app');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createBillingClient(m2mToken, input.secrets);

  const response = await getOutreachConfigResponse(oystehr);
  return { statusCode: 200, body: JSON.stringify(response) };
});
