import { APIGatewayProxyResult } from 'aws-lambda';
import { ZambdaInput } from '../../../../shared/types/common';
import { checkOrCreateM2MClientToken } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { wrapHandler } from '../../../../shared/sentry';
import { produceBirthdayOutreach } from '../shared/produce-birthday-outreach';

let m2mToken: string;

const ZAMBDA_NAME = 'cron-outreach-birthday';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.secrets) throw new Error('Secrets are not defined');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, input.secrets);

  const result = await produceBirthdayOutreach(oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
});
