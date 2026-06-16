import { MISSING_REQUEST_SECRETS, SearchBillingPatientsInput, SearchBillingPatientsInputSchema } from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export interface SearchBillingPatientsParams extends SearchBillingPatientsInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchBillingPatientsParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) return { secrets: input.secrets };

  const data = safeValidate(SearchBillingPatientsInputSchema, JSON.parse(input.body));

  return {
    ...data,
    secrets: input.secrets,
  };
}
