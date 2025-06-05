import { Secrets, UpdateNursingOrderParameters } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): UpdateNursingOrderParameters & { secrets: Secrets | null; userToken: string } {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  if (!input.headers.Authorization) {
    throw new Error('Authorization header is required');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: UpdateNursingOrderParameters;

  try {
    params = JSON.parse(input.body);
  } catch (error) {
    throw Error('Invalid JSON in request body');
  }

  if (!userToken) {
    throw new Error('User token is required');
  }

  if (!secrets) {
    throw new Error('Secrets are required');
  }

  if (!params.serviceRequestId) {
    throw new Error('Service Request ID is required');
  }

  if (!params.action) {
    throw new Error('Action is required');
  }

  console.groupEnd();
  console.log('validateRequestParameters success');
  return { userToken, secrets, ...params };
}
