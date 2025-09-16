import { ApplyTemplateZambdaInput, INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ExamType } from 'utils/lib/types/data/examination/examination';
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

  const { examType, templateName, encounterId } = parsedInput as Record<string, unknown>;

  // Validate required parameters
  const missingFields = [];
  if (examType === undefined) {
    missingFields.push('examType');
  }
  if (templateName === undefined) {
    missingFields.push('templateName');
  }
  if (encounterId === undefined) {
    missingFields.push('encounterId');
  }

  if (missingFields.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingFields);
  }

  // Validate examType is a valid ExamType enum value
  if (!Object.values(ExamType).includes(examType as ExamType)) {
    throw INVALID_INPUT_ERROR(`Invalid examType: ${examType}. Must be one of: ${Object.values(ExamType).join(', ')}`);
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
    examType: examType as ExamType,
    templateName,
    encounterId,
    secrets: input.secrets,
  };
}
