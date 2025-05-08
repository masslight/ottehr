import { GetPatientInstructionsInput, MISSING_AUTH_TOKEN } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): GetPatientInstructionsInput & Pick<ZambdaInput, 'secrets'> & { userToken: string } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const data = JSON.parse(input.body) as GetPatientInstructionsInput;

  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }

  if (data.type === undefined) {
    throw new Error('These fields are required: "type"');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  return { ...data, secrets: input.secrets, userToken };
}
