import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, TagBillingClaimInput, TagBillingClaimInputSchema } from 'utils';
import { formatZodError, ZambdaInput } from '../../shared';

export interface TagBillingClaimParams extends TagBillingClaimInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): TagBillingClaimParams {
  if (!input.body) throw MISSING_REQUEST_BODY;

  let raw: unknown;
  try {
    raw = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  const result = TagBillingClaimInputSchema.safeParse(raw);
  if (!result.success) throw INVALID_INPUT_ERROR(formatZodError(result.error));

  return { ...result.data, secrets: input.secrets };
}
