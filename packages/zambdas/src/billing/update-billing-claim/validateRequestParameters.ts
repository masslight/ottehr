import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  UpdateBillingResourceInput,
  UpdateBillingResourceInputSchema,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export type UpdateBillingClaimParams = UpdateBillingResourceInput & {
  secrets: ZambdaInput['secrets'];
};

export function validateRequestParameters(input: ZambdaInput): UpdateBillingClaimParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(UpdateBillingResourceInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
