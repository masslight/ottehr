import {
  CreateBillingWorkingCopyInput,
  CreateBillingWorkingCopyInputSchema,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
} from 'utils';
import { formatZodError, safeJsonParse, ZambdaInput } from '../../shared';
import { sanitizeOverrides } from '../shared';

export interface CreateWorkingCopyParams extends CreateBillingWorkingCopyInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CreateWorkingCopyParams {
  if (!input.body) throw MISSING_REQUEST_BODY;

  let raw: unknown;
  try {
    raw = safeJsonParse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  const result = CreateBillingWorkingCopyInputSchema.safeParse(raw);
  if (!result.success) throw INVALID_INPUT_ERROR(formatZodError(result.error));

  return {
    ...result.data,
    overrides: sanitizeOverrides(result.data.overrides),
    secrets: input.secrets,
  };
}
