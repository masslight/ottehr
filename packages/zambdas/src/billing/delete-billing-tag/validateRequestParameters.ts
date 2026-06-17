import {
  DeleteBillingTagInput,
  DeleteBillingTagInputSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface DeleteBillingTagParams extends DeleteBillingTagInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): DeleteBillingTagParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(DeleteBillingTagInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
