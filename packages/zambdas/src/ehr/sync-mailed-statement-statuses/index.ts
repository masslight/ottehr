import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput } from '../../shared/types/common';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { syncMailedStatementStatuses } from '../../shared/sync-mailed-statement-statuses';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'sync-mailed-statement-statuses';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets, batchSize } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  console.log('Starting on-demand sync of mailed statement statuses');

  const result = await syncMailedStatementStatuses(oystehr, secrets, batchSize);

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
});
