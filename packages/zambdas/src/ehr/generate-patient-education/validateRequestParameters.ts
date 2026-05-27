import { GeneratePatientEducationInput, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): GeneratePatientEducationInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { icdCode, icdDescription } = JSON.parse(input.body);

  const missingFields: string[] = [];
  if (!icdCode) missingFields.push('icdCode');
  if (!icdDescription) missingFields.push('icdDescription');
  if (missingFields.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingFields);
  }

  return {
    icdCode,
    icdDescription,
    secrets: input.secrets,
  };
}
