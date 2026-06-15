import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  SearchServiceFacilitiesInput,
  SearchServiceFacilitiesInputSchema,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export interface SearchServiceFacilitiesParams extends SearchServiceFacilitiesInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchServiceFacilitiesParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(SearchServiceFacilitiesInputSchema, JSON.parse(input.body));
  return {
    ...data,
    secrets: input.secrets,
  };
}
