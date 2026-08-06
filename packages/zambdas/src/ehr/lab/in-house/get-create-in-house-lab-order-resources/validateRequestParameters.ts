import { GetCreateInHouseLabOrderResourcesInput } from 'utils/lib/types/data/in-house/in-house.types';
import { Secrets } from 'utils/lib/secrets';
import { ZambdaInput } from '../../../../shared/types/common';
import { safeJsonParse } from '../../../../shared/validation';

export function validateRequestParameters(
  input: ZambdaInput
): GetCreateInHouseLabOrderResourcesInput & { secrets: Secrets | null; userToken: string } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: GetCreateInHouseLabOrderResourcesInput;

  try {
    params = safeJsonParse(input.body);
  } catch {
    throw Error('Invalid JSON in request body');
  }

  if (params.encounterId && typeof params.encounterId !== 'string') {
    throw Error('Encounter ID must be a string');
  }

  if (params.selectedLabSet && params.encounterId) {
    throw Error('Please pass either selectedLabSet or encounterId, not both parameters');
  }

  return { userToken, secrets, ...params };
}
