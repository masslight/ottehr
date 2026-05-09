import { ZambdaInput } from '../../shared';

export interface GeneratePatientEducationInput {
  icdCode: string;
  icdDescription: string;
}

export function validateRequestParameters(
  input: ZambdaInput
): GeneratePatientEducationInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { icdCode, icdDescription } = JSON.parse(input.body);

  if (!icdCode) {
    throw new Error('icdCode is required');
  }
  if (!icdDescription) {
    throw new Error('icdDescription is required');
  }

  return {
    icdCode,
    icdDescription,
    secrets: input.secrets,
  };
}
