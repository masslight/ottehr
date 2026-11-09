import { APIGatewayProxyResult } from 'aws-lambda';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { listChargeItemDefinitionVersions } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('get-version-history', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets, resourceId } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const versions = await listChargeItemDefinitionVersions(oystehr, resourceId);

  return {
    statusCode: 200,
    body: JSON.stringify({ versions }),
  };
});
