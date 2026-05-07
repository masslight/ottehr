import { APIGatewayProxyResult } from 'aws-lambda';
import { FhirResource } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND, getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, prepareWorkingCopy } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'create-billing-working-copy';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const params = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);

    const searchResult = await oystehr.fhir.search<FhirResource>({
      resourceType: params.resourceType,
      params: [{ name: '_id', value: params.resourceId }],
    });
    const original = searchResult.unbundle()[0];
    if (!original) throw FHIR_RESOURCE_NOT_FOUND(params.resourceType);

    // Clone the original and apply field overrides
    const copy = prepareWorkingCopy(original, params.resourceId);
    if (params.overrides) {
      for (const [key, value] of Object.entries(params.overrides)) {
        (copy as any)[key] = value;
      }
    }

    const created = await oystehr.fhir.create<FhirResource>(copy);

    return {
      statusCode: 200,
      body: JSON.stringify({ id: created.id, resourceType: params.resourceType }),
    };
  } catch (error: unknown) {
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});
