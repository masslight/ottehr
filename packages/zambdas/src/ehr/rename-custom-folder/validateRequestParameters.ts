import { INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS, RenameCustomFolderInput } from 'utils';
import { ZambdaInput } from '../../shared';

const FOLDER_NAME_REGEX = /^[a-zA-Z0-9+!\-_'()\\.@$ ]+$/;

export function validateRequestParameters(input: ZambdaInput): RenameCustomFolderInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsed = JSON.parse(input.body) as Record<string, unknown>;

  if (!parsed || typeof parsed !== 'object') {
    throw INVALID_INPUT_ERROR('Request body must be a valid JSON object');
  }

  const { internalName, newName } = parsed;

  const missing: string[] = [];
  if (internalName === undefined) missing.push('internalName');
  if (newName === undefined) missing.push('newName');
  if (missing.length > 0) throw MISSING_REQUIRED_PARAMETERS(missing);

  if (typeof internalName !== 'string' || internalName.trim() === '') {
    throw INVALID_INPUT_ERROR('internalName must be a non-empty string');
  }

  if (typeof newName !== 'string') {
    throw INVALID_INPUT_ERROR('newName must be a string');
  }

  const trimmedName = newName.trim();

  if (trimmedName.length < 1 || trimmedName.length > 60) {
    throw INVALID_INPUT_ERROR('newName must be between 1 and 60 characters');
  }

  if (!FOLDER_NAME_REGEX.test(trimmedName)) {
    throw INVALID_INPUT_ERROR(
      "newName contains invalid characters. Only letters, numbers, spaces, and these are allowed: + ! - _ ' ( ) . @ $"
    );
  }

  if (!input.secrets) {
    throw new Error('No secrets provided in input');
  }

  return {
    internalName: (internalName as string).trim(),
    newName: trimmedName,
    secrets: input.secrets,
  };
}
