import { APIGatewayProxyResult } from 'aws-lambda';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getSupportDialogPayload,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-support-dialog';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const { secrets } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const response = await getSupportDialogPayload(oystehr);
  return { statusCode: 200, body: JSON.stringify(response) };
});
