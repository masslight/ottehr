import { SetClaimStatusInput, SetClaimStatusInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { formatZodError } from '../../shared/validation';

export interface SetClaimStatusParams extends SetClaimStatusInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SetClaimStatusParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  let raw: unknown;
  try {
    raw = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  const result = SetClaimStatusInputSchema.safeParse(raw);
  if (!result.success) throw INVALID_INPUT_ERROR(formatZodError(result.error));

  return { ...result.data, secrets: input.secrets };
}
