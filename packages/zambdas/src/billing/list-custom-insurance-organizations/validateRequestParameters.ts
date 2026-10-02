import {
  ListCustomInsuranceOrganizationsInput,
  ListCustomInsuranceOrganizationsInputSchema,
} from 'utils/lib/types/data/billing/custom-insurance-org.schemas';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { validateJsonBody } from '../../shared/helpers';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';

export interface ListCustomInsuranceOrganizationsParams extends ListCustomInsuranceOrganizationsInput {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): ListCustomInsuranceOrganizationsParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(ListCustomInsuranceOrganizationsInputSchema, validateJsonBody(input));
  return {
    ...data,
    secrets: input.secrets,
  };
}
