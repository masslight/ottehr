import { Secrets, GetCreateInHouseLabOrderResourcesParameters } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): GetCreateInHouseLabOrderResourcesParameters & { secrets: Secrets | null; userToken: string } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: GetCreateInHouseLabOrderResourcesParameters;

  try {
    params = JSON.parse(input.body);
  } catch (error) {
    throw Error('Invalid JSON in request body');
  }

  return { userToken, secrets, ...params };
}
