import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient } from '../shared';
import { UpdateBillingClaimParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'update-billing-claim';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const params = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);

    const response = await performEffect(oystehr, params);
    return { statusCode: 200, body: JSON.stringify(response) };
  } catch (error: unknown) {
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

async function performEffect(oystehr: Oystehr, params: UpdateBillingClaimParams): Promise<{ id: string | undefined }> {
  const result = await oystehr.fhir.patch({
    resourceType: params.resourceType as any,
    id: params.resourceId,
    operations: params.operations,
  });

  return { id: result.id };
}
