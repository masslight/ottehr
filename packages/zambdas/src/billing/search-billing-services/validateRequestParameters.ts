import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import {
  SearchBillingServicesInput,
  SearchBillingServicesInputSchema,
} from 'utils/lib/types/data/billing/billing.schemas';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';
import { validateJsonBody } from '../../shared/helpers';

export interface SearchBillingServicesParams extends SearchBillingServicesInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchBillingServicesParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) throw MISSING_REQUEST_BODY;

  const data = safeValidate(SearchBillingServicesInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
