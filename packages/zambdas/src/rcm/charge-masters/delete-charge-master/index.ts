import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils';
import { createOystehrClient, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

export const index = wrapHandler('delete-charge-master', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { id, secrets } = validateRequestParameters(input);
    const oystehr = createOystehrClient(input.accessToken!, secrets);

    await oystehr.fhir.delete({
      resourceType: 'ChargeItemDefinition',
      id,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Charge master deleted successfully' }),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('delete-charge-master', error, ENVIRONMENT);
  }
});
