import { ExamType, INVALID_INPUT_ERROR, ListTemplatesZambdaInput, MISSING_REQUIRED_PARAMETERS } from 'utils';
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

  const { examType, includeVersionData } = parsedInput as Record<string, unknown>;

  // Validate required parameters
  const missingFields = [];
  if (examType === undefined) {
    missingFields.push('examType');
  }

  if (includeVersionData === undefined) {
    missingFields.push('includeCurrentVersion');
  }

  if (missingFields.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingFields);
  }

  // Validate examType is a valid ExamType enum value
  if (!Object.values(ExamType).includes(examType as ExamType)) {
    throw INVALID_INPUT_ERROR(`Invalid examType: ${examType}. Must be one of: ${Object.values(ExamType).join(', ')}`);
  }

  if (typeof includeVersionData !== 'boolean') {
    throw INVALID_INPUT_ERROR(`Invalid examType: ${includeVersionData}. Must be boolean.}`);
  }

  if (!input.secrets) {
    throw new Error('No secrets provided in input');
  }

  return {
    examType: examType as ExamType,
    includeVersionData,
    secrets: input.secrets,
  };
}
