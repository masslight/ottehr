import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import { createOystehrClient, RCM_TAG_SYSTEM, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

export const index = wrapHandler('list-charge-masters', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { secrets } = validateRequestParameters(input);
    const oystehr = createOystehrClient(input.accessToken!, secrets);

    const results = await oystehr.fhir.search<ChargeItemDefinition>({
      resourceType: 'ChargeItemDefinition',
      params: [
        {
          name: '_tag',
          value: `${RCM_TAG_SYSTEM}|charge-master`,
        },
      ],
    });

    const chargeMasters = results.unbundle();

    return {
      statusCode: 200,
      body: JSON.stringify(chargeMasters),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('list-charge-masters', error, ENVIRONMENT);
  }
});
