import {
  GetChargeItemDefinitionInput,
  GetChargeItemDefinitionInputSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export interface GetChargeItemDefinitionParams extends GetChargeItemDefinitionInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetChargeItemDefinitionParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) throw MISSING_REQUEST_BODY;

  const data = safeValidate(GetChargeItemDefinitionInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
