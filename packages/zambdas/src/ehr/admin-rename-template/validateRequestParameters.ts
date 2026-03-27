import { INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';

export interface AdminRenameTemplateInput {
  templateId: string;
  newName: string;
}

export function validateRequestParameters(input: ZambdaInput): AdminRenameTemplateInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsedInput = JSON.parse(input.body) as unknown;

  if (!parsedInput || typeof parsedInput !== 'object') {
    throw INVALID_INPUT_ERROR('Request body must be a valid JSON object');
  }

  const { templateId, newName } = parsedInput as Record<string, unknown>;

  const missingFields = [];
  if (templateId === undefined) {
    missingFields.push('templateId');
  }
  if (newName === undefined) {
    missingFields.push('newName');
  }

  if (missingFields.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingFields);
  }

  if (typeof templateId !== 'string' || templateId.trim() === '') {
    throw INVALID_INPUT_ERROR('templateId must be a non-empty string');
  }

  if (typeof newName !== 'string' || newName.trim() === '') {
    throw INVALID_INPUT_ERROR('newName must be a non-empty string');
  }

  if (!input.secrets) {
    throw new Error('No secrets provided in input');
  }

  return {
    templateId: templateId as string,
    newName: newName as string,
    secrets: input.secrets,
  };
}
