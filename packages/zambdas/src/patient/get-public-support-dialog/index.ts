import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { GetSupportDialogOutput } from 'utils/lib/types/data/support-dialog';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { ZambdaInput } from '../../shared/types/common';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { getAuth0Token } from '../../shared/getAuth0Token';
import { getSupportDialogPayload } from '../../shared/support-dialog';
import { topLevelCatch } from '../../shared/lambda';
import { wrapHandler } from '../../shared/sentry';

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
