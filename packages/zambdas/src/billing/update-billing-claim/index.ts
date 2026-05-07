import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'update-billing-claim';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const params = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);

    const result = await oystehr.fhir.patch({
      resourceType: params.resourceType as any,
      id: params.resourceId,
      operations: params.operations,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ id: result.id }),
    };
  } catch (error: unknown) {
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});
