import {
  CreateBillingProviderInput,
  CreateBillingProviderInputSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export type CreateBillingProviderParams = CreateBillingProviderInput & {
  secrets: ZambdaInput['secrets'];
};

export function validateRequestParameters(input: ZambdaInput): CreateBillingProviderParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(CreateBillingProviderInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
