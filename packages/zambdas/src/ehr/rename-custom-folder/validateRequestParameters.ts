import {
  MISSING_REQUEST_BODY,
  NOT_AUTHORIZED,
  RenameCustomFolderInputSchema,
  RenameCustomFolderInputValidated,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): RenameCustomFolderInputValidated {
  console.group('validateRequestParameters');

  if (!input.headers?.Authorization) {
    throw NOT_AUTHORIZED;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  const parsed = JSON.parse(input.body) as unknown;

  const { internalName, newName } = safeValidate(RenameCustomFolderInputSchema, parsed);

  console.groupEnd();
  console.debug('validateRequestParameters success');
  return {
    internalName,
    newName,
    secrets: input.secrets,
    userToken,
  };
}
