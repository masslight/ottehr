import { Secrets } from 'utils/lib/secrets';
import { SaveManualEraInput, SaveManualEraInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { getUserToken } from '../../shared/auth';
import { validateJsonBody } from '../../shared/helpers';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';

export interface SaveManualEraParams extends SaveManualEraInput {
  secrets: Secrets;
  // the caller's token, to record who keyed the remit in
  userToken: string;
}

export function validateRequestParameters(input: ZambdaInput): SaveManualEraParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(SaveManualEraInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
    userToken: getUserToken(input),
  };
}
