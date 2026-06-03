import { INVALID_INPUT_ERROR, SearchBillingPractitionersInput, SearchBillingPractitionersInputSchema } from 'utils';
import { formatZodError, ZambdaInput } from '../../shared';

export interface SearchBillingPractitionersParams extends SearchBillingPractitionersInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchBillingPractitionersParams {
  if (!input.body) return { secrets: input.secrets };

  let raw: unknown;
  try {
    raw = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  const result = SearchBillingPractitionersInputSchema.safeParse(raw);
  if (!result.success) throw INVALID_INPUT_ERROR(formatZodError(result.error));

  return { ...result.data, secrets: input.secrets };
}
