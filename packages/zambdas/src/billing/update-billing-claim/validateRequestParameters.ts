import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  UpdateBillingResourceInput,
  UpdateBillingResourceInputSchema,
} from 'utils';
import { formatZodError, ZambdaInput } from '../../shared';

export type UpdateBillingClaimParams = UpdateBillingResourceInput & {
  secrets: ZambdaInput['secrets'];
};

export function validateRequestParameters(input: ZambdaInput): UpdateBillingClaimParams {
  if (!input.body) throw MISSING_REQUEST_BODY;

  let raw: unknown;
  try {
    raw = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  const result = UpdateBillingResourceInputSchema.safeParse(raw);
  if (!result.success) throw INVALID_INPUT_ERROR(formatZodError(result.error));

  return { ...result.data, secrets: input.secrets };
}
