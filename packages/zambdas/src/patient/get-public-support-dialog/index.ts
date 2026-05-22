import { APIGatewayProxyResult } from 'aws-lambda';
import { createOystehrClient, getAuth0Token, getSupportDialogPayload, wrapHandler, ZambdaInput } from '../../shared';

let oystehrToken: string;
const ZAMBDA_NAME = 'get-public-support-dialog';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;
  if (!oystehrToken) {
    oystehrToken = await getAuth0Token(secrets);
  }
  const oystehr = createOystehrClient(oystehrToken, secrets);

  const response = await getSupportDialogPayload(oystehr);
  return { statusCode: 200, body: JSON.stringify(response) };
});
