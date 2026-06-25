import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { FhirResource } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { CopyableBillingResource, createBillingClient, fetchById, prepareWorkingCopy } from '../shared';
import { CreateWorkingCopyParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'create-billing-working-copy';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(
  oystehr: Oystehr,
  params: CreateWorkingCopyParams
): Promise<{ id: string | undefined; resourceType: string }> {
  const original = await fetchById<CopyableBillingResource>(oystehr, params.resourceType, params.resourceId);

  // Clone the original and apply field overrides
  const copy = prepareWorkingCopy(original, params.resourceId);
  if (params.overrides) {
    for (const [key, value] of Object.entries(params.overrides)) {
      (copy as any)[key] = value;
    }
  }

  const created = await oystehr.fhir.create<FhirResource>(copy);
  return { id: created.id, resourceType: params.resourceType };
}
