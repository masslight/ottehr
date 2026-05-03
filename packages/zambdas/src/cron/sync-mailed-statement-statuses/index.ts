import { APIGatewayProxyResult } from 'aws-lambda';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { syncMailedStatementStatuses } from '../../shared/sync-mailed-statement-statuses';

let m2mToken: string;

const ZAMBDA_NAME = 'sync-mailed-statement-statuses-cron';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;

  if (!secrets) {
    throw new Error('Secrets are not configured for this zambda');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  console.log('Starting scheduled sync of mailed statement statuses');

  const result = await syncMailedStatementStatuses(oystehr, secrets);

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
});
