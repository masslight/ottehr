import { CreatePatientInstructionsPdfInputSchema, CreatePatientInstructionsPdfInputValidated } from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): CreatePatientInstructionsPdfInputValidated {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  if (!input.headers?.Authorization) {
    throw new Error('Authorization header is required');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  const parsedJSON = JSON.parse(input.body) as unknown;

  const validatedParams = safeValidate(CreatePatientInstructionsPdfInputSchema, parsedJSON);

  console.groupEnd();
  console.debug('validateRequestParameters success');
  return {
    ...validatedParams,
    secrets: input.secrets,
    userToken,
  };
}
