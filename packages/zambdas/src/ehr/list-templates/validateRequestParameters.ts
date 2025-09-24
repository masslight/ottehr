import { INVALID_INPUT_ERROR, ListTemplatesZambdaInput, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ExamType } from 'utils/lib/types/data/examination/examination';
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

  const { examType } = parsedInput as Record<string, unknown>;

  // Validate required parameters
  const missingFields = [];
  if (examType === undefined) {
    missingFields.push('examType');
  }

  if (missingFields.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingFields);
  }

  // Validate examType is a valid ExamType enum value
  if (!Object.values(ExamType).includes(examType as ExamType)) {
    throw INVALID_INPUT_ERROR(`Invalid examType: ${examType}. Must be one of: ${Object.values(ExamType).join(', ')}`);
  }

  if (!input.secrets) {
    throw new Error('No secrets provided in input');
  }

  return {
    examType: examType as ExamType,
    secrets: input.secrets,
  };
}
