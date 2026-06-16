import { GetEraDetailInput, GetEraDetailInputSchema, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export interface GetEraDetailParams extends GetEraDetailInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetEraDetailParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(GetEraDetailInputSchema, JSON.parse(input.body));

  return {
    ...data,
    secrets: input.secrets,
  };
}
