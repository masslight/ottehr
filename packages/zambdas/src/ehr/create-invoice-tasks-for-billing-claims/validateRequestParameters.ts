import {
  CreateInvoiceTasksForBillingClaimsInputSchema,
  CreateInvoiceTasksForBillingClaimsValidatedInput,
} from 'utils/lib/types/api/invoicing.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

export function validateRequestParameters(input: ZambdaInput): CreateInvoiceTasksForBillingClaimsValidatedInput {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsedInput = safeValidate(CreateInvoiceTasksForBillingClaimsInputSchema, safeJsonParse(input.body));

  return {
    ...parsedInput,
    secrets: input.secrets,
  };
}
