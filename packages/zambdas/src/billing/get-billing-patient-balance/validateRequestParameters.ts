import {
  GetBillingPatientBalanceInput,
  GetBillingPatientBalanceInputSchema,
} from 'utils/lib/types/data/billing/billing.schemas';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';
import { validateJsonBody } from '../../shared/helpers';

export interface GetBillingPatientBalanceParams extends GetBillingPatientBalanceInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetBillingPatientBalanceParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(GetBillingPatientBalanceInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
