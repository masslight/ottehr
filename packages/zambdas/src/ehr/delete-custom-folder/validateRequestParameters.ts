import {
  DeleteCustomFolderInputSchema,
  DeleteCustomFolderInputValidated,
  MISSING_REQUEST_BODY,
  NOT_AUTHORIZED,
} from 'utils';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): DeleteCustomFolderInputValidated {
  console.group('validateRequestParameters');

  if (!input.headers?.Authorization) {
    throw NOT_AUTHORIZED;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  const parsed = safeJsonParse(input.body) as unknown;

  const { internalName } = safeValidate(DeleteCustomFolderInputSchema, parsed);

  console.groupEnd();
  console.debug('validateRequestParameters success');
  return {
    internalName,
    secrets: input.secrets,
    userToken,
  };
}
