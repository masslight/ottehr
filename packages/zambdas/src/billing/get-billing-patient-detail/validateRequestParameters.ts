import { GetPatientDetailInput, GetPatientDetailInputSchema, INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils';
import { formatZodError, safeJsonParse, ZambdaInput } from '../../shared';

export interface GetPatientDetailParams extends GetPatientDetailInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetPatientDetailParams {
  if (!input.body) throw MISSING_REQUEST_BODY;

  let raw: unknown;
  try {
    raw = safeJsonParse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  const result = GetPatientDetailInputSchema.safeParse(raw);
  if (!result.success) throw INVALID_INPUT_ERROR(formatZodError(result.error));

  return { ...result.data, secrets: input.secrets };
}
