import { GetInvoicesTasksValidatedInput, GetInvoicesTasksZambdaInputSchema } from 'utils/lib/types/api/invoicing.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

export function validateRequestParameters(input: ZambdaInput): GetInvoicesTasksValidatedInput {
  console.group('validateRequestParameters');

  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsedJSON = safeJsonParse(input.body) as unknown;

  const parsedInput = safeValidate(GetInvoicesTasksZambdaInputSchema, parsedJSON);

  console.groupEnd();
  console.debug('validateRequestParameters success');
  return {
    ...parsedInput,
    secrets: input.secrets,
  };
}
