import {
  CreateBillingWorkingCopyInput,
  CreateBillingWorkingCopyInputSchema,
} from 'utils/lib/types/data/billing/billing.schemas';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { validateJsonBody } from '../../shared/helpers';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';
import { sanitizeOverrides } from '../shared';

export interface CreateWorkingCopyParams extends CreateBillingWorkingCopyInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CreateWorkingCopyParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(CreateBillingWorkingCopyInputSchema, validateJsonBody(input));

  return {
    ...data,
    overrides: sanitizeOverrides(data.overrides),
    secrets: input.secrets,
  };
}
