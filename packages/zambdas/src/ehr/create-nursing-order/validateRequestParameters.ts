import { CreateNursingOrderParameters, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): CreateNursingOrderParameters & { secrets: Secrets | null; userToken: string } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  if (!input.headers.Authorization) {
    throw new Error('Authorization header is required');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: CreateNursingOrderParameters;

  try {
    params = JSON.parse(input.body);
  } catch {
    throw Error('Invalid JSON in request body');
  }

  if (!userToken) {
    throw new Error('User token is required');
  }

  if (!secrets) {
    throw new Error('Secrets are required');
  }

  if (!params.encounterId) {
    throw new Error('Encounter ID is required');
  }

  if (params.notes && typeof params.notes !== 'string') {
    throw new Error('Notes optional field, but if provided must be a string');
  }

  return { userToken, secrets, ...params };
}
