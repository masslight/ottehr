import {
  GetPatientCoveragesInput,
  GetPatientCoveragesInputSchema,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
} from 'utils';
import { formatZodError, ZambdaInput } from '../../shared';

export interface GetPatientCoveragesParams extends GetPatientCoveragesInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetPatientCoveragesParams {
  if (!input.body) throw MISSING_REQUEST_BODY;

  let raw: unknown;
  try {
    raw = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  const result = GetPatientCoveragesInputSchema.safeParse(raw);
  if (!result.success) throw INVALID_INPUT_ERROR(formatZodError(result.error));

  return { ...result.data, secrets: input.secrets };
}
