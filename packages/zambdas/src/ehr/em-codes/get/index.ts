import { APIGatewayProxyResult } from 'aws-lambda';
import { EmCodeOutput } from 'utils/lib/types/api/config/em-codes';
import { getEmCodes } from 'utils/lib/helpers/em-codes';
import { ZambdaInput } from '../../../shared/types/common';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler('get-em-codes', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const codes = await getEmCodes(oystehr);
  const response: EmCodeOutput = {
    codes,
  };
  return { statusCode: 200, body: JSON.stringify(response) };
});
