import { DeletePatientInstructionInput } from 'ehr-utils';
import { ZambdaInput } from '../types';

export function validateRequestParameters(
  input: ZambdaInput
): DeletePatientInstructionInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const data = JSON.parse(input.body) as DeletePatientInstructionInput;

  if (input.headers.Authorization === undefined) {
    throw new Error('AuthToken is not provided in headers');
  }

  if (data.id === undefined) {
    throw new Error('These fields are required: "type"');
  }

  return { ...data, secrets: input.secrets };
}
