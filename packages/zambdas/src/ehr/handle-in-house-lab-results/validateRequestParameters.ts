import { HandleInHouseLabResultsParameters, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): HandleInHouseLabResultsParameters & { secrets: Secrets | null; userToken: string } {
  // todo throw better errors here

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;
  const { serviceRequestId, data } = JSON.parse(input.body);

  const missingResources = [];
  if (!serviceRequestId) missingResources.push('serviceRequestID');
  if (!data) missingResources.push('data');
  if (missingResources.length) {
    // throw MISSING_REQUIRED_PARAMETERS(missingResources);
    throw new Error(`missing resources: ${missingResources.join(',')}`);
  }

  return { userToken, secrets, serviceRequestId, data };
}
