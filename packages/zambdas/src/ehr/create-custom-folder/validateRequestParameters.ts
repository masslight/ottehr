import {
  CreateCustomFolderInputSchema,
  CreateCustomFolderInputValidated,
  MISSING_REQUEST_BODY,
  NOT_AUTHORIZED,
} from 'utils';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): CreateCustomFolderInputValidated {
  console.group('validateRequestParameters');

  if (!input.headers?.Authorization) {
    throw NOT_AUTHORIZED;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  const parsed = safeJsonParse(input.body) as unknown;

  const { folderName } = safeValidate(CreateCustomFolderInputSchema, parsed);

  console.groupEnd();
  console.debug('validateRequestParameters success');
  return {
    folderName,
    secrets: input.secrets,
    userToken,
  };
}
