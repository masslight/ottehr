import { GetPatientInstructionsInput } from 'utils';
import { ZambdaInput } from 'zambda-utils';

export function validateRequestParameters(
  input: ZambdaInput
): GetPatientInstructionsInput & Pick<ZambdaInput, 'secrets'> & { userToken: string } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const data = JSON.parse(input.body) as GetPatientInstructionsInput;

  if (input.headers.Authorization === undefined) {
    throw new Error('AuthToken is not provided in headers');
  }

  if (data.type === undefined) {
    throw new Error('These fields are required: "type"');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  return { ...data, secrets: input.secrets, userToken };
}
