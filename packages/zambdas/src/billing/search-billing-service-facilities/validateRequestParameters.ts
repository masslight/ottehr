import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  SearchServiceFacilitiesInput,
  SearchServiceFacilitiesInputSchema,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface SearchServiceFacilitiesParams extends SearchServiceFacilitiesInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchServiceFacilitiesParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(SearchServiceFacilitiesInputSchema, validateJsonBody(input));
  return {
    ...data,
    secrets: input.secrets,
  };
}
