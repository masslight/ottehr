import { GetBillingClaimsInput, GetBillingClaimsInputSchema, INVALID_INPUT_ERROR } from 'utils';
import { formatZodError, ZambdaInput } from '../../shared';

export interface GetBillingClaimsParams extends GetBillingClaimsInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetBillingClaimsParams {
  if (!input.body) return { secrets: input.secrets };

  let raw: unknown;
  try {
    raw = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  const result = GetBillingClaimsInputSchema.safeParse(raw);
  if (!result.success) throw INVALID_INPUT_ERROR(formatZodError(result.error));

  return { ...result.data, secrets: input.secrets };
}
