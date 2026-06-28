import { GetEraDetailInput, GetEraDetailInputSchema, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface GetEraDetailParams extends GetEraDetailInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetEraDetailParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(GetEraDetailInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
