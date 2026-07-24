import {
  CreateInvoiceTasksForBillingClaimsInputSchema,
  CreateInvoiceTasksForBillingClaimsValidatedInput,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): CreateInvoiceTasksForBillingClaimsValidatedInput {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsedInput = safeValidate(CreateInvoiceTasksForBillingClaimsInputSchema, safeJsonParse(input.body));

  return {
    ...parsedInput,
    secrets: input.secrets,
  };
}
