import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { SearchErasInput, SearchErasInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';
import { validateJsonBody } from '../../shared/helpers';

export interface SearchErasParams extends SearchErasInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchErasParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) return { secrets: input.secrets };

  const data = safeValidate(SearchErasInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
