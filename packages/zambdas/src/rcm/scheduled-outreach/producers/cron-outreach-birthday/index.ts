import { APIGatewayProxyResult } from 'aws-lambda';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../../shared';
import { produceBirthdayOutreach } from '../shared/produce-birthday-outreach';

let m2mToken: string;

const ZAMBDA_NAME = 'cron-outreach-birthday';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.secrets) throw new Error('Secrets are not defined');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createOystehrClient(m2mToken, input.secrets);

  const result = await produceBirthdayOutreach(oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
});
