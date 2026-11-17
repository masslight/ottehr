import { GetBillingInvoiceVisitInputSchema } from 'utils/lib/types/api/invoicing.types';
import { MISCONFIGURED_ENVIRONMENT_ERROR } from 'utils/lib/types/errors';
import { isOttehrBillingInvoicingInBillingApp } from '../../shared/invoice-tasks';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';

export function validateRequestParameters(
  input: ZambdaInput
): ValidatedZambdaInput<typeof GetBillingInvoiceVisitInputSchema> {
  const params = validateWithSchema(GetBillingInvoiceVisitInputSchema, input);
  if (!isOttehrBillingInvoicingInBillingApp(params.secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Invoicing is not enabled in the billing app');
  }
  return params;
}
