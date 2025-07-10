import { DeleteInHouseLabOrderParameters, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): DeleteInHouseLabOrderParameters & { secrets: Secrets | null; userToken: string } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: DeleteInHouseLabOrderParameters;

  try {
    params = JSON.parse(input.body);
  } catch (error) {
    throw Error('Invalid JSON in request body');
  }

  if (!params.serviceRequestId) {
    throw new Error('Service request ID is required');
  }

  return { userToken, secrets, ...params };
}
