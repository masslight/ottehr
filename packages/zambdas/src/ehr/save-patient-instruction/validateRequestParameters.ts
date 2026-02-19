import { MISSING_AUTH_TOKEN, SavePatientInstructionInput } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): SavePatientInstructionInput & Pick<ZambdaInput, 'secrets'> & { userToken: string } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const data = JSON.parse(input.body) as SavePatientInstructionInput;

  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }
  const userToken = input.headers.Authorization.replace('Bearer ', '');

  const { text, title } = data;
  const hasText = typeof text === 'string' && text.trim().length > 0;
  const hasTitle = typeof title === 'string' && title.trim().length > 0;

  if (!hasText && !hasTitle) {
    throw new Error('Either text or title must be provided');
  }

  return { ...data, secrets: input.secrets, userToken };
}
