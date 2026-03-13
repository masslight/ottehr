import {
  GetInvoicesTasksValidatedInput,
  GetInvoicesTasksZambdaInputSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): GetInvoicesTasksValidatedInput {
  console.group('validateRequestParameters');

  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsedJSON = JSON.parse(input.body) as unknown;

  const parsedInput = safeValidate(GetInvoicesTasksZambdaInputSchema, parsedJSON);

  console.groupEnd();
  console.debug('validateRequestParameters success');
  return {
    ...parsedInput,
    secrets: input.secrets,
  };
}
