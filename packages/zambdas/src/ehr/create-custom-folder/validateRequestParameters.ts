import { CreateCustomFolderInput, INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';

const FOLDER_NAME_REGEX = /^[a-zA-Z0-9+!\-_'()\\.@$ ]+$/;

export function validateRequestParameters(input: ZambdaInput): CreateCustomFolderInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsed = JSON.parse(input.body) as Record<string, unknown>;

  if (!parsed || typeof parsed !== 'object') {
    throw INVALID_INPUT_ERROR('Request body must be a valid JSON object');
  }

  const { folderName } = parsed;

  if (folderName === undefined) {
    throw MISSING_REQUIRED_PARAMETERS(['folderName']);
  }

  if (typeof folderName !== 'string') {
    throw INVALID_INPUT_ERROR('folderName must be a string');
  }

  const trimmed = folderName.trim();

  if (trimmed.length < 1 || trimmed.length > 60) {
    throw INVALID_INPUT_ERROR('folderName must be between 1 and 60 characters');
  }

  if (!FOLDER_NAME_REGEX.test(trimmed)) {
    throw INVALID_INPUT_ERROR(
      "folderName contains invalid characters. Only letters, numbers, spaces, and these are allowed: + ! - _ ' ( ) . @ $"
    );
  }

  if (!input.secrets) {
    throw new Error('No secrets provided in input');
  }

  return {
    folderName: trimmed,
    secrets: input.secrets,
  };
}
