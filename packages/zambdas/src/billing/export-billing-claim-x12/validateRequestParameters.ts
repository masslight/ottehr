import { ExportClaimX12Input, ExportClaimX12InputSchema, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface ExportClaimX12Params extends ExportClaimX12Input {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): ExportClaimX12Params {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(ExportClaimX12InputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
