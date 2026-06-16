import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  UpdateBillingResourceInput,
  UpdateBillingResourceInputSchema,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export type UpdateBillingClaimParams = UpdateBillingResourceInput & {
  secrets: ZambdaInput['secrets'];
};

export function validateRequestParameters(input: ZambdaInput): UpdateBillingClaimParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(UpdateBillingResourceInputSchema, JSON.parse(input.body));

  return {
    ...data,
    secrets: input.secrets,
  };
}
