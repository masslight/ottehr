import { Secrets } from 'utils/lib/secrets';
import {
  AdminUpdateSupportDialogInput,
  AdminUpdateSupportDialogInputSchema,
} from 'utils/lib/types/data/support-dialog';
import { INVALID_INPUT_ERROR, MISSING_AUTH_TOKEN, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse } from '../../../shared/validation';

export function validateRequestParameters(
  input: ZambdaInput
): AdminUpdateSupportDialogInput & { secrets: Secrets | null; userToken: string } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }
  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: unknown;
  try {
    params = safeJsonParse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const result = AdminUpdateSupportDialogInputSchema.safeParse(params);
  if (!result.success) {
    throw INVALID_INPUT_ERROR(`Validation failed: ${JSON.stringify(result.error.errors)}`);
  }

  return { ...result.data, secrets, userToken };
}
