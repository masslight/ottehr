import { APIGatewayProxyResult } from 'aws-lambda';
import { EmCodeOutput, getEmCodes } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler('get-em-codes', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const codes = await getEmCodes(oystehr);
  const response: EmCodeOutput = {
    codes,
  };
  return { statusCode: 200, body: JSON.stringify(response) };
});
