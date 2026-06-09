import { INVALID_INPUT_ERROR, ListTemplatesZambdaInput, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): ListTemplatesZambdaInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsedInput = JSON.parse(input.body) as unknown;

  // Type guard to check if parsedInput is an object
  if (!parsedInput || typeof parsedInput !== 'object') {
    throw INVALID_INPUT_ERROR('Request body must be a valid JSON object');
  }

  const { includeVersionData } = parsedInput as Record<string, unknown>;

  // Validate required parameters
  const missingFields = [];

  if (includeVersionData === undefined) {
    missingFields.push('includeVersionData');
  }

  if (missingFields.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingFields);
  }

  if (typeof includeVersionData !== 'boolean') {
    throw INVALID_INPUT_ERROR(`Invalid includeVersionData: ${includeVersionData}. Must be boolean.`);
  }

  if (!input.secrets) {
    throw new Error('No secrets provided in input');
  }

  return {
    includeVersionData,
    secrets: input.secrets,
  };
}
