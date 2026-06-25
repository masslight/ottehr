import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, GetSupportDialogOutput, SecretsKeys } from 'utils';
import {
  createClinicalOystehrClient,
  getAuth0Token,
  getSupportDialogPayload,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';

let oystehrToken: string;
const ZAMBDA_NAME = 'get-public-support-dialog';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  try {
    const { secrets } = input;
    if (!oystehrToken) {
      oystehrToken = await getAuth0Token(secrets);
    }
    const oystehr = createClinicalOystehrClient(oystehrToken, secrets);

    const response = await performEffect(oystehr);
    return { statusCode: 200, body: JSON.stringify(response) };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const performEffect = async (oystehr: Oystehr): Promise<GetSupportDialogOutput> => {
  return await getSupportDialogPayload(oystehr);
};
