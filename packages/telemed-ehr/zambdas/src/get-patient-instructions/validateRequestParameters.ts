import { ZambdaInput } from '../types';
import { GetPatientInstructionsInput } from 'ehr-utils';

export function validateRequestParameters(
  input: ZambdaInput
): GetPatientInstructionsInput & Pick<ZambdaInput, 'secrets'> {
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

  return { ...data, secrets: input.secrets };
}
