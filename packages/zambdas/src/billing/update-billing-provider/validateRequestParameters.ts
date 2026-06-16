import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  UpdateBillingProviderInput,
  UpdateBillingProviderInputSchema,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export type UpdateBillingProviderParams = UpdateBillingProviderInput & {
  secrets: ZambdaInput['secrets'];
};

export function validateRequestParameters(input: ZambdaInput): UpdateBillingProviderParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(UpdateBillingProviderInputSchema, JSON.parse(input.body));

  return {
    ...data,
    secrets: input.secrets,
  };
}
