import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization, Practitioner } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { BILLING_WORKING_COPY_TAG, createBillingClient, fetchById, hasTag, PROVIDER_ROLE_TAG } from '../shared';
import { DeleteBillingProviderParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'delete-billing-provider';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

// Claims snapshot their provider into a per-claim working copy and never reference the
// original, so deleting an original only removes it from the provider pick lists. Working
// copies carry claim data
async function performEffect(oystehr: Oystehr, params: DeleteBillingProviderParams): Promise<{ deleted: true }> {
  const resourceType = params.kind === 'individual' ? 'Practitioner' : 'Organization';
  const provider = await fetchById<Practitioner | Organization>(oystehr, resourceType, params.providerId);
  if (hasTag(provider, BILLING_WORKING_COPY_TAG.system, BILLING_WORKING_COPY_TAG.code)) {
    throw INVALID_INPUT_ERROR('Cannot delete a working copy — it belongs to a claim');
  }
  if (!provider.meta?.tag?.some((t) => t.system === PROVIDER_ROLE_TAG)) {
    throw FHIR_RESOURCE_NOT_FOUND(resourceType);
  }

  await oystehr.fhir.delete({ resourceType, id: params.providerId });
  return { deleted: true };
}
