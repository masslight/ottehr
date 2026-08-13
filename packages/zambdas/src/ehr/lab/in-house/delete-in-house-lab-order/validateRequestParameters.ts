import { Secrets } from 'utils/lib/secrets';
import { DeleteInHouseLabOrderParameters } from 'utils/lib/types/data/in-house/in-house.types';
import { ZambdaInput } from '../../../../shared/types/common';
import { safeJsonParse } from '../../../../shared/validation';

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
    params = safeJsonParse(input.body);
  } catch {
    throw Error('Invalid JSON in request body');
  }

  if (!params.serviceRequestId) {
    throw new Error('Service request ID is required');
  }

  return { userToken, secrets, ...params };
}
