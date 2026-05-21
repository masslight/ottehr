import { ApplyTemplateZambdaInput, INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): ApplyTemplateZambdaInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsedInput = JSON.parse(input.body) as unknown;

  // Type guard to check if parsedInput is an object
  if (!parsedInput || typeof parsedInput !== 'object') {
    throw INVALID_INPUT_ERROR('Request body must be a valid JSON object');
  }

  const { templateName, encounterId } = parsedInput as Record<string, unknown>;

  // Validate required parameters
  const missingFields = [];
  if (templateName === undefined) {
    missingFields.push('templateName');
  }
  if (encounterId === undefined) {
    missingFields.push('encounterId');
  }

  if (missingFields.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingFields);
  }

  // Validate templateName is a string
  if (typeof templateName !== 'string') {
    throw INVALID_INPUT_ERROR('templateName must be a string');
  }

  if (typeof encounterId !== 'string') {
    throw INVALID_INPUT_ERROR('encounterId must be a string');
  }

  if (!input.secrets) {
    throw new Error('No secrets provided in input');
  }

  return {
    templateName,
    encounterId,
    secrets: input.secrets,
  };
}
