import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, UpdateEmCodeInput, UpdateEmCodeInputSchema } from 'utils';
import { safeJsonParse, ZambdaInput } from '../../../shared';

export function validateRequestParameters(input: ZambdaInput): UpdateEmCodeInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  let parsed: unknown;
  try {
    parsed = safeJsonParse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const result = UpdateEmCodeInputSchema.safeParse(parsed);
  if (!result.success) {
    console.error(
      'Hit validation error during zod parsing. Tried to parse this json:',
      JSON.stringify(result.error.errors),
      JSON.stringify(parsed)
    );
    throw INVALID_INPUT_ERROR(`Validation failed: ${JSON.stringify(result.error.errors)}`);
  }

  return result.data;
}
