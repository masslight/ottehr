import { SearchBillingInvoicesInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { MISCONFIGURED_ENVIRONMENT_ERROR } from 'utils/lib/types/errors';
import { isOttehrBillingInvoicingInBillingApp } from '../../shared/invoice-tasks';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';

export type SearchBillingInvoicesParams = ValidatedZambdaInput<typeof SearchBillingInvoicesInputSchema>;

export function validateRequestParameters(input: ZambdaInput): SearchBillingInvoicesParams {
  const params = validateWithSchema(SearchBillingInvoicesInputSchema, input);
  if (!isOttehrBillingInvoicingInBillingApp(params.secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Invoicing is not enabled in the billing app');
  }
  return params;
}
