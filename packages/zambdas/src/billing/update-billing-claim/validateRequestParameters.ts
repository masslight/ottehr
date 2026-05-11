import { Operation } from 'fast-json-patch';
import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  UpdateBillingClaimInput,
  UpdateBillingClaimInputSchema,
} from 'utils';
import { formatZodError, ZambdaInput } from '../../shared';

export interface UpdateBillingClaimParams extends Omit<UpdateBillingClaimInput, 'operations'> {
  operations: Operation[];
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): UpdateBillingClaimParams {
  if (!input.body) throw MISSING_REQUEST_BODY;

  let raw: unknown;
  try {
    raw = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  const result = UpdateBillingClaimInputSchema.safeParse(raw);
  if (!result.success) throw INVALID_INPUT_ERROR(formatZodError(result.error));

  return {
    resourceId: result.data.resourceId,
    resourceType: result.data.resourceType,
    operations: result.data.operations as Operation[],
    secrets: input.secrets,
  };
}
