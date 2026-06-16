import {
  CreateBillingWorkingCopyInput,
  CreateBillingWorkingCopyInputSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';
import { sanitizeOverrides } from '../shared';

export interface CreateWorkingCopyParams extends CreateBillingWorkingCopyInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CreateWorkingCopyParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(CreateBillingWorkingCopyInputSchema, JSON.parse(input.body));

  return {
    ...data,
    overrides: sanitizeOverrides(data.overrides),
    secrets: input.secrets,
  };
}
