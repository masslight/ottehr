import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('delete-fee-schedule', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { id, secrets } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    await oystehr.fhir.delete({
      resourceType: 'ChargeItemDefinition',
      id,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Fee schedule deleted successfully' }),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('delete-fee-schedule', error, ENVIRONMENT);
  }
});
