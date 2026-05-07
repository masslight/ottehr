import { CreateCustomFolderInputSchema, CreateCustomFolderInputValidated } from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): CreateCustomFolderInputValidated {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  if (!input.headers?.Authorization) {
    throw new Error('Authorization header is required');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  const parsed = JSON.parse(input.body) as unknown;

  const { folderName } = safeValidate(CreateCustomFolderInputSchema, parsed);

  console.groupEnd();
  console.debug('validateRequestParameters success');
  return {
    folderName,
    secrets: input.secrets,
    userToken,
  };
}
