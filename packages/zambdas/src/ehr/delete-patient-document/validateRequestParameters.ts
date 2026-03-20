import { DeletePatientDocumentInput, INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): DeletePatientDocumentInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsedInput = JSON.parse(input.body) as unknown;

  if (!parsedInput || typeof parsedInput !== 'object') {
    throw INVALID_INPUT_ERROR('Request body must be a valid JSON object');
  }

  const { documentRefId } = parsedInput as Record<string, unknown>;

  const missingFields = [];
  if (documentRefId === undefined) {
    missingFields.push('documentRefId');
  }

  if (missingFields.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingFields);
  }

  if (typeof documentRefId !== 'string') {
    throw INVALID_INPUT_ERROR('documentRefId must be a string');
  }

  if (!input.secrets) {
    throw new Error('No secrets provided in input');
  }

  return {
    documentRefId,
    secrets: input.secrets,
  };
}
