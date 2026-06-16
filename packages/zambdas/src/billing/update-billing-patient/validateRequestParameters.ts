import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  UpdateBillingPatientInput,
  UpdateBillingPatientInputSchema,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export interface UpdateBillingPatientParams extends UpdateBillingPatientInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): UpdateBillingPatientParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(UpdateBillingPatientInputSchema, JSON.parse(input.body));

  return {
    ...data,
    secrets: input.secrets,
  };
}
