import {
  CreateChargeItemDefinitionInput,
  CreateChargeItemDefinitionInputSchema,
} from 'utils/lib/types/data/billing/billing.schemas';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { validateJsonBody } from '../../shared/helpers';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';

export interface CreateChargeItemDefinitionParams extends CreateChargeItemDefinitionInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CreateChargeItemDefinitionParams {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;
  if (!input.body) throw MISSING_REQUEST_BODY;

  const data = safeValidate(CreateChargeItemDefinitionInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
