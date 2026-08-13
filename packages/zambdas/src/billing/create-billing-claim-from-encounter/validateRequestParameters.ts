import {
  CreateBillingClaimFromEncounterInput,
  CreateBillingClaimFromEncounterInputSchema,
} from 'utils/lib/types/data/billing/billing.schemas';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { validateJsonBody } from '../../shared/helpers';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';

export interface CreateClaimFromEncounterParams extends CreateBillingClaimFromEncounterInput {
  secrets: NonNullable<ZambdaInput['secrets']>;
}

export function validateRequestParameters(input: ZambdaInput): CreateClaimFromEncounterParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(CreateBillingClaimFromEncounterInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
