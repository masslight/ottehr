import {
  DeleteNonInsuranceOrgInput,
  DeleteNonInsuranceOrgInputSchema,
} from 'utils/lib/types/data/billing/non-insurance-org.schemas';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { validateJsonBody } from '../../shared/helpers';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';

export interface DeleteNonInsuranceOrgParams extends DeleteNonInsuranceOrgInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): DeleteNonInsuranceOrgParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(DeleteNonInsuranceOrgInputSchema, validateJsonBody(input));
  return {
    ...data,
    secrets: input.secrets,
  };
}
