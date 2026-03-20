import { ExamType, INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';

export interface AdminCreateTemplateInput {
  encounterId: string;
  templateName: string;
  examType: ExamType;
}

export function validateRequestParameters(input: ZambdaInput): AdminCreateTemplateInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsedInput = JSON.parse(input.body) as unknown;

  if (!parsedInput || typeof parsedInput !== 'object') {
    throw INVALID_INPUT_ERROR('Request body must be a valid JSON object');
  }

  const { encounterId, templateName, examType } = parsedInput as Record<string, unknown>;

  const missingFields = [];
  if (encounterId === undefined) {
    missingFields.push('encounterId');
  }
  if (templateName === undefined) {
    missingFields.push('templateName');
  }
  if (examType === undefined) {
    missingFields.push('examType');
  }

  if (missingFields.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingFields);
  }

  if (typeof encounterId !== 'string' || encounterId.trim() === '') {
    throw INVALID_INPUT_ERROR('encounterId must be a non-empty string');
  }

  if (typeof templateName !== 'string' || templateName.trim() === '') {
    throw INVALID_INPUT_ERROR('templateName must be a non-empty string');
  }

  if (!Object.values(ExamType).includes(examType as ExamType)) {
    throw INVALID_INPUT_ERROR(`Invalid examType: ${examType}. Must be one of: ${Object.values(ExamType).join(', ')}`);
  }

  if (!input.secrets) {
    throw new Error('No secrets provided in input');
  }

  return {
    encounterId: encounterId as string,
    templateName: templateName as string,
    examType: examType as ExamType,
    secrets: input.secrets,
  };
}
