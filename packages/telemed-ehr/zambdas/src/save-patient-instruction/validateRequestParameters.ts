import { ZambdaInput } from '../types';
import { SavePatientInstructionInput } from 'ehr-utils';

export function validateRequestParameters(
  input: ZambdaInput
): SavePatientInstructionInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const data = JSON.parse(input.body) as SavePatientInstructionInput;

  if (input.headers.Authorization === undefined) {
    throw new Error('AuthToken is not provided in headers');
  }

  return { ...data, secrets: input.secrets };
}
