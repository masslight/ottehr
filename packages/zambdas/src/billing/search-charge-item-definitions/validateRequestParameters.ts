import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  SearchChargeItemDefinitionsInput,
  SearchChargeItemDefinitionsInputSchema,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface SearchChargeItemDefinitionsParams extends SearchChargeItemDefinitionsInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): SearchChargeItemDefinitionsParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) throw MISSING_REQUEST_BODY;

  const data = safeValidate(SearchChargeItemDefinitionsInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
