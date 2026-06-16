import { MISSING_REQUEST_SECRETS, SearchErasInput, SearchErasInputSchema } from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export interface SearchErasParams extends SearchErasInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchErasParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) return { secrets: input.secrets };

  const data = safeValidate(SearchErasInputSchema, JSON.parse(input.body));

  return {
    ...data,
    secrets: input.secrets,
  };
}
