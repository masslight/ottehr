import { GetClaimDetailInput, GetClaimDetailInputSchema, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface GetClaimDetailParams extends GetClaimDetailInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetClaimDetailParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(GetClaimDetailInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
