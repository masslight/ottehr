import { INVALID_INPUT_ERROR, SearchBillingLocationsInput, SearchBillingLocationsInputSchema } from 'utils';
import { formatZodError, safeJsonParse, ZambdaInput } from '../../shared';

export interface SearchBillingLocationsParams extends SearchBillingLocationsInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchBillingLocationsParams {
  if (!input.body) return { secrets: input.secrets };

  let raw: unknown;
  try {
    raw = safeJsonParse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  const result = SearchBillingLocationsInputSchema.safeParse(raw);
  if (!result.success) throw INVALID_INPUT_ERROR(formatZodError(result.error));

  return { ...result.data, secrets: input.secrets };
}
