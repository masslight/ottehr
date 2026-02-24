import { CreateInHouseLabOrderParameters, Secrets } from 'utils';
import { ZambdaInput } from '../../../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): CreateInHouseLabOrderParameters & { secrets: Secrets | null; userToken: string } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  if (!input.headers.Authorization) {
    throw new Error('Authorization header is required');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: CreateInHouseLabOrderParameters;

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

  if (!params.testItems) {
    throw new Error('testItems is required');
  }

  if (!params.diagnosesAll || !Array.isArray(params.diagnosesAll)) {
    throw new Error('DiagnosesAll are required and must be an non-empty array');
  }

  if (!Array.isArray(params.diagnosesNew)) {
    throw new Error('Diagnoses are required and must be an array');
  }

  if (params.notes && typeof params.notes !== 'string') {
    throw new Error('Notes optional field, but if provided must be a string');
  }

  return { userToken, secrets, ...params };
}
