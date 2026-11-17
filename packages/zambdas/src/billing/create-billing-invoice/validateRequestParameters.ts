import { CreateBillingInvoiceInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { MISCONFIGURED_ENVIRONMENT_ERROR } from 'utils/lib/types/errors';
import { isOttehrBillingInvoicingInBillingApp } from '../../shared/invoice-tasks';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';

export type CreateBillingInvoiceParams = ValidatedZambdaInput<typeof CreateBillingInvoiceInputSchema>;

export function validateRequestParameters(input: ZambdaInput): CreateBillingInvoiceParams {
  const params = validateWithSchema(CreateBillingInvoiceInputSchema, input);
  if (!isOttehrBillingInvoicingInBillingApp(params.secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Invoicing is not enabled in the billing app');
  }
  return params;
}
