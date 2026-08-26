import { DeleteEmCodeInput, DeleteEmCodeInputSchema } from 'utils/lib/types/api/config/em-codes';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse } from '../../../shared/validation';

export function validateRequestParameters(input: ZambdaInput): DeleteEmCodeInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  let parsed: unknown;
  try {
    parsed = safeJsonParse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const result = DeleteEmCodeInputSchema.safeParse(parsed);
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
